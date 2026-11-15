/**
 * Autor: Nathan Kenzo Puzipe
 *
 * Rota da listagem de demandas (filtros, busca e ordenação):
 *   GET /demandas?usuarioId=N[&status=][&prioridade=][&tipo=][&projeto=]
 *                  [&responsavel=][&busca=][&ordenarPor=][&ordem=]
 *
 * Reunião 5: os dados agora vêm do banco Oracle (ver ../bd.ts). A estrutura da
 * rota e a validação dos parâmetros são as mesmas da Reunião 4; mudou só a forma
 * de acessar os dados (SQL no lugar dos arrays de dadosTeste.ts).
 *
 * Quem pede a lista precisa se identificar com usuarioId (como o POST /demandas
 * já faz). O Administrador enxerga todas as demandas; o Líder de Projeto e o
 * Membro da Equipe enxergam só as dos projetos a que estão vinculados (item 2.1
 * do Documento de Visão).
 *
 * Todo valor que vem da URL entra no SQL por variável de ligação (:nome), nunca
 * concatenado. O único texto montado "na mão" é o ORDER BY, e ele só usa valores
 * de listas fixas deste arquivo e de tipos.ts, nunca o que o usuário digitou.
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { TIPOS, PRIORIDADES, STATUS } from "../tipos";

const router = Router();

// Campos aceitos na ordenação
const CAMPOS_ORDENACAO: string[] = ["prioridade", "dataCriacao", "prazo", "status"];

// Mesmas regras de tamanho da busca usadas na tela (js/validacoes.js)
const BUSCA_MIN = 2;
const BUSCA_MAX = 100;

// Letras com acento e a versão sem acento, na mesma posição. O banco usa as duas
// listas (TRANSLATE) para a busca não depender de acento nem de maiúscula.
const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüç";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuuc";

// Remove acentos e maiúsculas, para a busca e os filtros não dependerem disso
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Procura o valor oficial na lista ("em revisao" vira "Em revisão"). Se não existir, devolve undefined
function acharValor(entrada: string, lista: string[]): string | undefined {
  return lista.find(function (valor) {
    return normalizar(valor) === normalizar(entrada);
  });
}

// Lê um parâmetro da URL como texto.
// Devolve undefined se não veio (ou veio vazio) e null se veio repetido (?a=1&a=2)
function lerParametro(valor: unknown): string | undefined | null {
  if (valor === undefined) {
    return undefined;
  }
  if (typeof valor !== "string") {
    return null;
  }
  const texto = valor.trim();
  return texto === "" ? undefined : texto;
}

// Escapa % _ \ para o termo digitado valer como texto comum dentro do LIKE
function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, "\\$&");
}

// CASE que transforma o valor de uma lista (prioridade ou status) na sua posição,
// para ordenar pela ordem da lista e não pela ordem alfabética.
// Os valores vêm das listas fixas de tipos.ts; mesmo assim as aspas são duplicadas.
function ordemDaLista(coluna: string, lista: string[]): string {
  const quando = lista.map(function (valor, posicao) {
    return "WHEN '" + valor.replace(/'/g, "''") + "' THEN " + posicao;
  });
  return "CASE " + coluna + " " + quando.join(" ") + " ELSE " + lista.length + " END";
}

// Condições e valores já validados, prontos para virar SQL
export interface FiltrosDaListagem {
  usuarioId: number;
  verTodosOsProjetos: boolean; // true para o Administrador
  status?: string;
  prioridade?: string;
  tipo?: string;
  projetoId?: number;
  responsavelId?: number;
  semResponsavel?: boolean;
  busca?: string;              // texto digitado (será normalizado aqui)
  ordenarPor: string;
  ordem: "asc" | "desc";
}

// Monta o SELECT com apenas as condições que foram pedidas.
// Só entram em "valores" as variáveis que aparecem no SQL (o driver recusa sobras).
export function montarConsulta(f: FiltrosDaListagem): { sql: string; valores: { [nome: string]: string | number } } {
  const condicoes: string[] = [];
  const valores: { [nome: string]: string | number } = {};

  // Líder e Membro só veem as demandas dos projetos a que estão vinculados
  if (!f.verTodosOsProjetos) {
    condicoes.push("d.projeto_id IN (SELECT up.projeto_id FROM usuario_projeto up WHERE up.usuario_id = :usuarioId)");
    valores.usuarioId = f.usuarioId;
  }
  if (f.status) {
    condicoes.push("d.status = :status");
    valores.status = f.status;
  }
  if (f.prioridade) {
    condicoes.push("d.prioridade = :prioridade");
    valores.prioridade = f.prioridade;
  }
  if (f.tipo) {
    condicoes.push("d.tipo = :tipo");
    valores.tipo = f.tipo;
  }
  if (f.projetoId !== undefined) {
    condicoes.push("d.projeto_id = :projetoId");
    valores.projetoId = f.projetoId;
  }
  if (f.responsavelId !== undefined) {
    condicoes.push("d.responsavel_id = :responsavelId");
    valores.responsavelId = f.responsavelId;
  }
  if (f.semResponsavel) {
    condicoes.push("d.responsavel_id IS NULL");
  }
  if (f.busca) {
    // Busca por título ou descrição, sem diferenciar acento nem maiúscula
    const semAcento = "TRANSLATE(LOWER(%), '" + COM_ACENTO + "', '" + SEM_ACENTO + "')";
    condicoes.push(
      "(" + semAcento.replace("%", "d.titulo") + " LIKE :termo ESCAPE '\\' OR " +
      semAcento.replace("%", "d.descricao") + " LIKE :termo ESCAPE '\\')"
    );
    valores.termo = "%" + escaparLike(normalizar(f.busca)) + "%";
  }

  // Prioridade e status seguem a ordem das listas de tipos.ts:
  // em "asc", Crítica vem primeiro e Aberta vem antes de Concluída.
  // Demandas sem prazo ficam sempre no fim, tanto em asc quanto em desc.
  // Em caso de empate, a ordem fica estável pelo id.
  const sentido = f.ordem === "asc" ? "ASC" : "DESC";
  let ordenacao: string;
  if (f.ordenarPor === "prioridade") {
    ordenacao = ordemDaLista("d.prioridade", PRIORIDADES) + " " + sentido;
  } else if (f.ordenarPor === "status") {
    ordenacao = ordemDaLista("d.status", STATUS) + " " + sentido;
  } else if (f.ordenarPor === "prazo") {
    ordenacao = "d.prazo " + sentido + " NULLS LAST";
  } else {
    ordenacao = "d.data_criacao " + sentido;
  }

  const sql =
    `SELECT d.id AS "id", d.titulo AS "titulo", d.tipo AS "tipo",
            d.prioridade AS "prioridade", d.status AS "status",
            d.projeto_id AS "projetoId", p.nome AS "projeto",
            d.responsavel_id AS "responsavelId", u.nome AS "responsavel",
            TO_CHAR(d.data_criacao, 'YYYY-MM-DD"T"HH24:MI:SS') AS "dataCriacao",
            TO_CHAR(d.prazo, 'YYYY-MM-DD') AS "prazo"
       FROM demanda d
       JOIN projeto p ON p.id = d.projeto_id
       LEFT JOIN usuario u ON u.id = d.responsavel_id` +
    (condicoes.length > 0 ? "\n      WHERE " + condicoes.join("\n        AND ") : "") +
    "\n      ORDER BY " + ordenacao + ", d.id";

  return { sql: sql, valores: valores };
}

interface LinhaDaListagem {
  id: number;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  projetoId: number;
  projeto: string;
  responsavelId: number | null;
  responsavel: string | null;
  dataCriacao: string;
  prazo: string | null;
}

router.get("/demandas", async function (req: Request, res: Response) {
  const erros: string[] = [];

  // ---------- 1) Leitura dos parâmetros ----------
  const parametros = {
    usuarioId: lerParametro(req.query.usuarioId),
    status: lerParametro(req.query.status),
    prioridade: lerParametro(req.query.prioridade),
    tipo: lerParametro(req.query.tipo),
    projeto: lerParametro(req.query.projeto),
    responsavel: lerParametro(req.query.responsavel),
    busca: lerParametro(req.query.busca),
    ordenarPor: lerParametro(req.query.ordenarPor),
    ordem: lerParametro(req.query.ordem)
  };

  // ---------- 2) Quem está pedindo a lista ----------
  // Sem usuário identificado (ou com um id que não existe) a resposta é 401.
  if (!parametros.usuarioId || !/^\d+$/.test(parametros.usuarioId)) {
    res.status(401).json({
      erro: "Usuário não identificado",
      detalhes: ["Informe usuarioId com o id do usuário logado."]
    });
    return;
  }
  const usuarioId = Number(parametros.usuarioId);
  const usuario = await executar<{ perfil: string }>(
    `SELECT perfil AS "perfil" FROM usuario WHERE id = :id`,
    { id: usuarioId }
  );
  if (!usuario.rows || usuario.rows.length === 0) {
    res.status(401).json({
      erro: "Usuário não identificado",
      detalhes: ["usuarioId não corresponde a nenhum usuário cadastrado."]
    });
    return;
  }

  // ---------- 3) Validação (a API não confia nas validações da tela) ----------
  for (const nome of Object.keys(parametros)) {
    if ((parametros as Record<string, string | undefined | null>)[nome] === null) {
      erros.push('O parâmetro "' + nome + '" deve ser informado uma única vez.');
    }
  }

  const status = parametros.status ? acharValor(parametros.status, STATUS) : undefined;
  if (parametros.status && !status) {
    erros.push("status inválido. Valores aceitos: " + STATUS.join(", ") + ".");
  }

  const prioridade = parametros.prioridade ? acharValor(parametros.prioridade, PRIORIDADES) : undefined;
  if (parametros.prioridade && !prioridade) {
    erros.push("prioridade inválida. Valores aceitos: " + PRIORIDADES.join(", ") + ".");
  }

  const tipo = parametros.tipo ? acharValor(parametros.tipo, TIPOS) : undefined;
  if (parametros.tipo && !tipo) {
    erros.push("tipo inválido. Valores aceitos: " + TIPOS.join(", ") + ".");
  }

  let projetoId: number | undefined;
  if (parametros.projeto) {
    if (/^\d+$/.test(parametros.projeto)) {
      projetoId = Number(parametros.projeto);
    } else {
      erros.push("projeto deve ser o id numérico do projeto.");
    }
  }

  // responsavel pode ser um id ou a palavra "sem" (demandas sem responsável)
  let responsavelId: number | undefined;
  let semResponsavel = false;
  if (parametros.responsavel) {
    if (normalizar(parametros.responsavel) === "sem") {
      semResponsavel = true;
    } else if (/^\d+$/.test(parametros.responsavel)) {
      responsavelId = Number(parametros.responsavel);
    } else {
      erros.push('responsavel deve ser o id numérico do usuário ou "sem".');
    }
  }

  if (parametros.busca) {
    if (parametros.busca.length < BUSCA_MIN) {
      erros.push("busca deve ter pelo menos " + BUSCA_MIN + " caracteres.");
    } else if (parametros.busca.length > BUSCA_MAX) {
      erros.push("busca deve ter no máximo " + BUSCA_MAX + " caracteres.");
    }
  }

  const ordenarPor = parametros.ordenarPor ? acharValor(parametros.ordenarPor, CAMPOS_ORDENACAO) : undefined;
  if (parametros.ordenarPor && !ordenarPor) {
    erros.push("ordenarPor inválido. Valores aceitos: " + CAMPOS_ORDENACAO.join(", ") + ".");
  }

  const ordemInformada = parametros.ordem ? normalizar(parametros.ordem) : undefined;
  if (ordemInformada && ordemInformada !== "asc" && ordemInformada !== "desc") {
    erros.push('ordem inválida. Valores aceitos: "asc" ou "desc".');
  }

  if (erros.length > 0) {
    res.status(400).json({ erro: "Parâmetros inválidos", detalhes: erros });
    return;
  }

  // ---------- 4) Consulta ao banco ----------
  const campo = ordenarPor || "dataCriacao";
  const ordem: "asc" | "desc" = ordemInformada === "asc" || ordemInformada === "desc"
    ? ordemInformada
    : (campo === "dataCriacao" ? "desc" : "asc");

  const consulta = montarConsulta({
    usuarioId: usuarioId,
    verTodosOsProjetos: usuario.rows[0].perfil === "Administrador",
    status: status,
    prioridade: prioridade,
    tipo: tipo,
    projetoId: projetoId,
    responsavelId: responsavelId,
    semResponsavel: semResponsavel,
    busca: parametros.busca ?? undefined,
    ordenarPor: campo,
    ordem: ordem
  });

  const resultado = await executar<LinhaDaListagem>(consulta.sql, consulta.valores);
  const lista = resultado.rows ?? [];

  // ---------- 5) Resposta ----------
  res.status(200).json({
    total: lista.length,
    ordenacao: { campo: campo, ordem: ordem },
    demandas: lista
  });
});

export default router;