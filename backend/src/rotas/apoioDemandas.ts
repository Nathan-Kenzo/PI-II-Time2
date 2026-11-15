/**
 * Autor: Henrique Aguiar de Souza Pella
 */

import { Request, Response } from "express";
import { executar } from "../bd";

const ADMINISTRADOR = "Administrador";

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
