/**
 * Autor: Henrique Aguiar de Souza Pella
 *
 * Descrição: funções de apoio usadas pelas rotas (não registra nenhuma rota).
 * Leitura de campos, tratamento de erros, busca de usuário e demanda,
 * datas, consulta de feriados e os limites de tamanho dos textos.
 */

import { Request, Response } from "express";
import { executar } from "../bd";

export const ADMINISTRADOR = "Administrador";
export const MEMBRO_DA_EQUIPE = "Membro da Equipe";

// Limites de tamanho do título e da descrição (cadastro e edição de demanda)
export const TITULO_MIN = 5;
export const TITULO_MAX = 150;
export const DESCRICAO_MIN = 10;
export const DESCRICAO_MAX = 2000;

const API_FERIADOS = "https://brasilapi.com.br/api/feriados/v1/";
const TEMPO_LIMITE_API_FERIADOS_MS = 5000;
const AVISO_API_FERIADOS_INDISPONIVEL = "A API de feriados estava indisponível; o prazo foi gravado sem essa conferência.";

export interface DemandaGravada {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  status: string;
  projetoId: number;
  projeto: string;
  responsavelId: number | null;
  responsavel: string | null;
  dataCriacao: Date;
  dataAtualizacao: Date;
  prazo: string | null;
}

export interface UsuarioLogado {
  id: number;
  perfil: string;
}

export interface UsuarioNoProjeto {
  id: number;
  perfil: string;
  vinculado: number;
}

export class ErroDeRequisicao extends Error {
  status: number;
  detalhes?: string[];

  constructor(status: number, mensagem: string, detalhes?: string[]) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export function comTratamentoDeErros(rota: (req: Request, res: Response) => Promise<void>) {
  return async function (req: Request, res: Response): Promise<void> {
    try {
      await rota(req, res);
    } catch (erro) {
      if (!(erro instanceof ErroDeRequisicao)) {
        throw erro;
      }
      res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
    }
  };
}

export function lerTexto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor.trim() : undefined;
}

export function lerId(valor: unknown): number | undefined {
  const id = typeof valor === "string" && /^\d+$/.test(valor.trim()) ? Number(valor) : valor;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : undefined;
}

export function exigirObjetoJson(corpo: unknown): Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ErroDeRequisicao(400, "Corpo da requisição deve ser um objeto JSON.");
  }
  return corpo as Record<string, unknown>;
}

// Remove acentos e maiúsculas: "critica" e "Crítica" passam a ser iguais
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Procura o valor oficial na lista ("documentacao" vira "Documentação")
export function acharValor(entrada: string, lista: string[]): string | undefined {
  return lista.find(function (valor) {
    return normalizar(valor) === normalizar(entrada);
  });
}

// Confere se o texto é uma data real no formato AAAA-MM-DD (31/02 é recusado)
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

// Data de hoje em AAAA-MM-DD, no fuso do servidor
export function dataDeHoje(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// Feriados já consultados, por ano, para não chamar a API externa a cada pedido
const feriadosPorAno: Record<string, { date: string; name: string }[]> = {};

// Confere na API externa de feriados nacionais (BrasilAPI) se o prazo cai em feriado.
// Se a API não responder, o prazo é aceito e volta um aviso.
export async function conferirFeriado(prazo: string): Promise<{ erro?: string; aviso?: string }> {
  const ano = prazo.substring(0, 4);
  try {
    if (!feriadosPorAno[ano]) {
      const resposta = await fetch(API_FERIADOS + ano, { signal: AbortSignal.timeout(TEMPO_LIMITE_API_FERIADOS_MS) });
      if (!resposta.ok) {
        throw new Error(`BrasilAPI respondeu com status ${resposta.status}`);
      }
      feriadosPorAno[ano] = await resposta.json();
    }
    const feriado = feriadosPorAno[ano].find(function (candidato) { return candidato.date === prazo; });
    return feriado ? { erro: `prazo cai em um feriado nacional (${feriado.name}). Escolha outra data.` } : {};
  } catch (erro) {
    console.warn("Falha ao consultar a API de feriados:", erro);
    return { aviso: AVISO_API_FERIADOS_INDISPONIVEL };
  }
}

// Confere o usuário que fez o pedido (?usuarioId=N). Sem um usuário válido a resposta é 401.
export async function exigirUsuario(valor: unknown): Promise<UsuarioLogado> {
  const id = lerId(valor);
  if (id === undefined) {
    throw new ErroDeRequisicao(401, "Usuário não identificado", ["Informe usuarioId com o id do usuário logado."]);
  }
  const resultado = await executar<UsuarioLogado>(`SELECT id AS "id", perfil AS "perfil" FROM usuario WHERE id = :id`, { id });
  const usuario = resultado.rows?.[0];
  if (!usuario) {
    throw new ErroDeRequisicao(401, "Usuário não identificado", ["usuarioId não corresponde a nenhum usuário cadastrado."]);
  }
  return usuario;
}

export function temAcessoAoProjeto(usuario: UsuarioNoProjeto): boolean {
  return usuario.perfil === ADMINISTRADOR || usuario.vinculado > 0;
}

export async function buscarUsuario(id: number, projetoId: number): Promise<UsuarioNoProjeto | undefined> {
  const resultado = await executar<UsuarioNoProjeto>(
    `SELECT u.id AS "id", u.perfil AS "perfil",
            (SELECT COUNT(*) FROM usuario_projeto up
              WHERE up.usuario_id = u.id AND up.projeto_id = :projetoId) AS "vinculado"
       FROM usuario u
      WHERE u.id = :id`,
    { id, projetoId }
  );
  return resultado.rows?.[0];
}

export async function buscarAutor(usuarioId: unknown, projetoId: number): Promise<UsuarioNoProjeto | undefined> {
  const id = lerId(usuarioId);
  return id === undefined ? undefined : buscarUsuario(id, projetoId);
}

export async function buscarDemandaExistente(id: number): Promise<DemandaGravada> {
  const resultado = await executar<DemandaGravada>(
    `SELECT d.id AS "id", d.titulo AS "titulo", d.descricao AS "descricao", d.tipo AS "tipo",
            d.prioridade AS "prioridade", d.status AS "status",
            d.projeto_id AS "projetoId", p.nome AS "projeto",
            d.responsavel_id AS "responsavelId", u.nome AS "responsavel",
            d.data_criacao AS "dataCriacao", d.data_atualizacao AS "dataAtualizacao",
            TO_CHAR(d.prazo, 'YYYY-MM-DD') AS "prazo"
       FROM demanda d
       JOIN projeto p ON p.id = d.projeto_id
       LEFT JOIN usuario u ON u.id = d.responsavel_id
      WHERE d.id = :id`,
    { id }
  );
  const demanda = resultado.rows?.[0];
  if (!demanda) {
    throw new ErroDeRequisicao(404, "Demanda não encontrada.");
  }
  return demanda;
}

export async function buscarDemandaDaUrl(idDaUrl: unknown): Promise<DemandaGravada> {
  const id = lerId(idDaUrl);
  if (id === undefined) {
    throw new ErroDeRequisicao(400, "O id da demanda deve ser um número inteiro.");
  }
  return buscarDemandaExistente(id);
}
