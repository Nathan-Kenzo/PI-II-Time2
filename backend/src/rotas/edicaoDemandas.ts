/**
 * Autor: Henrique Aguiar de Souza Pella
 *
 * Descrição: edição de demanda.
 *   PATCH /demandas/:id   { usuarioId, titulo?, descricao?, tipo?, prioridade?, responsavelId?, prazo?, status? }
 * Confere a permissão do perfil antes das regras de negócio (transição de status,
 * responsável e feriado) e grava no histórico cada campo alterado.
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { TIPOS, PRIORIDADES, STATUS } from "../tipos";
import {
  DemandaGravada,
  UsuarioNoProjeto,
  ErroDeRequisicao,
  comTratamentoDeErros,
  lerTexto,
  lerId,
  exigirObjetoJson,
  temAcessoAoProjeto,
  buscarUsuario,
  buscarAutor,
  buscarDemandaExistente,
  buscarDemandaDaUrl,
  MEMBRO_DA_EQUIPE,
  TITULO_MIN,
  TITULO_MAX,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  acharValor,
  dataValida,
  dataDeHoje,
  conferirFeriado
} from "./apoioDemandas";

const router = Router();

const TRANSICOES_DE_STATUS: Record<string, string[]> = {
  "Aberta": ["Em andamento", "Cancelada"],
  "Em andamento": ["Em revisão", "Cancelada"],
  "Em revisão": ["Em andamento", "Concluída", "Cancelada"],
  "Concluída": [],
  "Cancelada": []
};

const TRANSICOES_DO_MEMBRO: Record<string, string[]> = {
  "Aberta": ["Em andamento"],
  "Em andamento": ["Em revisão"]
};

const CAMPOS_EDITAVEIS = ["titulo", "descricao", "tipo", "prioridade", "responsavelId", "prazo", "status"] as const;
type CampoEditavel = typeof CAMPOS_EDITAVEIS[number];

const ATRIBUICOES_SQL: Record<CampoEditavel, string> = {
  titulo: "titulo = :titulo",
  descricao: "descricao = :descricao",
  tipo: "tipo = :tipo",
  prioridade: "prioridade = :prioridade",
  responsavelId: "responsavel_id = :responsavelId",
  prazo: "prazo = TO_DATE(:prazo, 'YYYY-MM-DD')",
  status: "status = :status"
};

const NOMES_DOS_CAMPOS: Record<CampoEditavel, string> = {
  titulo: "o título",
  descricao: "a descrição",
  tipo: "o tipo",
  prioridade: "a prioridade",
  responsavelId: "o responsável",
  prazo: "o prazo",
  status: "o status"
};

type Alteracoes = Partial<Pick<DemandaGravada, CampoEditavel>>;
type Validacao<T> = { valor: T } | { erro: string };


function estaVazio(valor: unknown): boolean {
  return valor === null || valor === "";
}

function ehStatusFinal(status: string): boolean {
  return TRANSICOES_DE_STATUS[status].length === 0;
}


function validarTexto(valor: unknown, campo: string, minimo: number, maximo: number): Validacao<string> {
  const texto = lerTexto(valor) ?? "";
  if (texto.length < minimo) {
    return { erro: `${campo} deve ter pelo menos ${minimo} caracteres.` };
  }
  if (texto.length > maximo) {
    return { erro: `${campo} deve ter no máximo ${maximo} caracteres.` };
  }
  return { valor: texto };
}

function validarOpcao(valor: unknown, campo: string, opcoes: string[]): Validacao<string> {
  const texto = lerTexto(valor);
  const opcaoOficial = texto !== undefined ? acharValor(texto, opcoes) : undefined;
  return opcaoOficial ? { valor: opcaoOficial } : { erro: `Valor inválido para ${campo}. Valores aceitos: ${opcoes.join(", ")}.` };
}

function validarResponsavelId(valor: unknown): Validacao<number | null> {
  if (estaVazio(valor)) {
    return { valor: null };
  }
  const id = lerId(valor);
  return id === undefined ? { erro: "responsavelId deve ser o id de um usuário existente ou null." } : { valor: id };
}

function validarPrazo(valor: unknown): Validacao<string | null> {
  if (estaVazio(valor)) {
    return { valor: null };
  }
  const prazo = lerTexto(valor);
  if (!prazo || !dataValida(prazo)) {
    return { erro: "prazo deve ser uma data válida no formato AAAA-MM-DD." };
  }
  if (prazo < dataDeHoje()) {
    return { erro: "prazo não pode ser uma data passada." };
  }
  return { valor: prazo };
}

const VALIDADORES: Record<CampoEditavel, (valor: unknown) => Validacao<string | number | null>> = {
  titulo: (valor) => validarTexto(valor, "titulo", TITULO_MIN, TITULO_MAX),
  descricao: (valor) => validarTexto(valor, "descricao", DESCRICAO_MIN, DESCRICAO_MAX),
  tipo: (valor) => validarOpcao(valor, "tipo", TIPOS),
  prioridade: (valor) => validarOpcao(valor, "prioridade", PRIORIDADES),
  responsavelId: validarResponsavelId,
  prazo: validarPrazo,
  status: (valor) => validarOpcao(valor, "status", STATUS)
};

function lerAlteracoes(corpo: Record<string, unknown>, demanda: DemandaGravada): { alteracoes: Alteracoes; erros: string[] } {
  const alteracoes: Alteracoes = {};
  const erros: string[] = [];
  for (const campo of CAMPOS_EDITAVEIS) {
    if (corpo[campo] === undefined || corpo[campo] === demanda[campo]) {
      continue;
    }
    const resultado = VALIDADORES[campo](corpo[campo]);
    if ("erro" in resultado) {
      erros.push(resultado.erro);
    } else if (resultado.valor !== demanda[campo]) {
      Object.assign(alteracoes, { [campo]: resultado.valor });
    }
  }
  return { alteracoes, erros };
}


function validarTransicaoDeStatus(statusAtual: string, statusNovo: string): string | undefined {
  if (TRANSICOES_DE_STATUS[statusAtual].includes(statusNovo)) {
    return undefined;
  }
  return `Não é permitido alterar o status de ${statusAtual} para ${statusNovo}.`;
}

async function validarResponsavel(responsavelId: number, projetoId: number): Promise<string | undefined> {
  const responsavel = await buscarUsuario(responsavelId, projetoId);
  if (!responsavel) {
    return "responsavelId deve ser o id de um usuário existente.";
  }
  if (!temAcessoAoProjeto(responsavel)) {
    return "O responsável precisa estar vinculado ao projeto da demanda.";
  }
  return undefined;
}

async function validarRegrasDeNegocio(alteracoes: Alteracoes, demanda: DemandaGravada): Promise<{ erros: string[]; aviso?: string }> {
  const conferenciaDoPrazo = alteracoes.prazo ? await conferirFeriado(alteracoes.prazo) : {};
  const erros = [
    alteracoes.status ? validarTransicaoDeStatus(demanda.status, alteracoes.status) : undefined,
    alteracoes.responsavelId ? await validarResponsavel(alteracoes.responsavelId, demanda.projetoId) : undefined,
    conferenciaDoPrazo.erro
  ];
  return {
    erros: erros.filter(function (erro): erro is string { return erro !== undefined; }),
    aviso: conferenciaDoPrazo.aviso
  };
}


function motivoDaRecusaAoMembro(membroId: number, demanda: DemandaGravada, alteracoes: Alteracoes): string | undefined {
  const alteraOutrosCampos = Object.keys(alteracoes).some(function (campo) { return campo !== "status"; });
  if (alteraOutrosCampos) {
    return "O Membro da Equipe só pode alterar o status da demanda.";
  }
  if (demanda.responsavelId !== membroId) {
    return "O Membro da Equipe só altera o status das demandas em que é o responsável.";
  }
  const transicoesPermitidas = TRANSICOES_DO_MEMBRO[demanda.status] ?? [];
  if (alteracoes.status && !transicoesPermitidas.includes(alteracoes.status)) {
    return "O Membro da Equipe só pode mudar o status de Aberta para Em andamento e de Em andamento para Em revisão.";
  }
  return undefined;
}

function exigirPermissao(autor: UsuarioNoProjeto, demanda: DemandaGravada, alteracoes: Alteracoes): void {
  if (!temAcessoAoProjeto(autor)) {
    throw new ErroDeRequisicao(403, "O usuário não está vinculado ao projeto desta demanda.");
  }
  const motivo = autor.perfil === MEMBRO_DA_EQUIPE ? motivoDaRecusaAoMembro(autor.id, demanda, alteracoes) : undefined;
  if (motivo) {
    throw new ErroDeRequisicao(403, motivo);
  }
}


async function buscarDemandaEditavel(idDaUrl: unknown): Promise<DemandaGravada> {
  const demanda = await buscarDemandaDaUrl(idDaUrl);
  if (ehStatusFinal(demanda.status)) {
    throw new ErroDeRequisicao(400, `Demandas com status ${demanda.status} não aceitam alterações.`);
  }
  return demanda;
}

function exigirCorpoComAlteracao(corpo: unknown): Record<string, unknown> {
  const dados = exigirObjetoJson(corpo);
  const informouAlgumCampo = CAMPOS_EDITAVEIS.some(function (campo) { return dados[campo] !== undefined; });
  if (!informouAlgumCampo) {
    throw new ErroDeRequisicao(400, `Informe pelo menos um campo para alterar: ${CAMPOS_EDITAVEIS.join(", ")}.`);
  }
  return dados;
}


async function atualizarDemanda(demanda: DemandaGravada, alteracoes: Alteracoes): Promise<void> {
  const campos = Object.keys(alteracoes) as CampoEditavel[];
  const atribuicoes = campos.map(function (campo) { return ATRIBUICOES_SQL[campo]; }).join(", ");
  const resultado = await executar(
    `UPDATE demanda SET ${atribuicoes}, data_atualizacao = SYSTIMESTAMP
      WHERE id = :id AND status = :statusAtual`,
    { ...alteracoes, id: demanda.id, statusAtual: demanda.status }
  );
  if (resultado.rowsAffected === 0) {
    throw new ErroDeRequisicao(409, "A demanda foi alterada por outra pessoa. Recarregue a página e tente de novo.");
  }
}

function valorLegivel(campo: CampoEditavel, demanda: DemandaGravada): string {
  if (campo === "responsavelId") {
    return demanda.responsavel ?? "(nenhum)";
  }
  if (campo === "prazo") {
    return demanda.prazo ? demanda.prazo.split("-").reverse().join("/") : "(nenhum)";
  }
  return String(demanda[campo]);
}

function descreverMudanca(campo: CampoEditavel, antes: DemandaGravada, depois: DemandaGravada): string {
  if (campo === "titulo" || campo === "descricao") {
    return `alterou ${NOMES_DOS_CAMPOS[campo]} da demanda.`;
  }
  return `alterou ${NOMES_DOS_CAMPOS[campo]} da demanda de ${valorLegivel(campo, antes)} para ${valorLegivel(campo, depois)}.`;
}

async function registrarHistorico(antes: DemandaGravada, depois: DemandaGravada, autorId: number): Promise<void> {
  const camposAlterados = CAMPOS_EDITAVEIS.filter(function (campo) { return antes[campo] !== depois[campo]; });
  for (const campo of camposAlterados) {
    await executar(
      `INSERT INTO historico (demanda_id, usuario_id, descricao) VALUES (:demandaId, :usuarioId, :descricao)`,
      { demandaId: antes.id, usuarioId: autorId, descricao: descreverMudanca(campo, antes, depois) }
    );
  }
}

async function aplicarAlteracoes(demanda: DemandaGravada, alteracoes: Alteracoes, autorId: number): Promise<DemandaGravada> {
  await atualizarDemanda(demanda, alteracoes);
  const demandaAtualizada = await buscarDemandaExistente(demanda.id);
  await registrarHistorico(demanda, demandaAtualizada, autorId);
  return demandaAtualizada;
}


async function editarDemanda(idDaUrl: unknown, corpo: unknown): Promise<{ demanda: DemandaGravada; aviso?: string }> {
  const demanda = await buscarDemandaEditavel(idDaUrl);
  const dados = exigirCorpoComAlteracao(corpo);
  const { alteracoes, erros } = lerAlteracoes(dados, demanda);
  const autor = await buscarAutor(dados.usuarioId, demanda.projetoId);
  if (!autor || erros.length > 0) {
    throw new ErroDeRequisicao(400, "Dados inválidos", [...(autor ? [] : ["usuarioId deve ser o id de um usuário existente."]), ...erros]);
  }
  // A permissão vem antes das regras de negócio, que consultam o banco e a API de feriados
  exigirPermissao(autor, demanda, alteracoes);
  const regras = await validarRegrasDeNegocio(alteracoes, demanda);
  if (regras.erros.length > 0) {
    throw new ErroDeRequisicao(400, "Dados inválidos", regras.erros);
  }
  if (Object.keys(alteracoes).length === 0) {
    return { demanda };
  }
  return { demanda: await aplicarAlteracoes(demanda, alteracoes, autor.id), aviso: regras.aviso };
}

router.patch("/demandas/:id", comTratamentoDeErros(async function (req: Request, res: Response) {
  res.status(200).json(await editarDemanda(req.params.id, req.body));
}));

export default router;
