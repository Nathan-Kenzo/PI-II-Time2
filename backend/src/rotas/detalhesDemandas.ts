/**
 * Autor: Henrique Aguiar de Souza Pella
 *
 * Descrição: detalhes, comentários e histórico de uma demanda.
 *   GET  /demandas/:id?usuarioId=N
 *   GET  /demandas/:id/comentarios?usuarioId=N
 *   POST /demandas/:id/comentarios   { usuarioId, texto }
 *   GET  /demandas/:id/historico?usuarioId=N
 * Nos GETs: 401 sem usuário válido e 403 se ele não tem acesso ao projeto da demanda.
 */

import { Router, Request, Response } from "express";
import { executar, SAIDA_NUMERO } from "../bd";
import {
  DemandaGravada,
  UsuarioNoProjeto,
  ErroDeRequisicao,
  comTratamentoDeErros,
  lerTexto,
  exigirObjetoJson,
  temAcessoAoProjeto,
  buscarUsuario,
  buscarAutor,
  buscarDemandaDaUrl,
  exigirUsuario
} from "./apoioDemandas";

const router = Router();

const COMENTARIO_MIN = 3;
const COMENTARIO_MAX = 2000;

const SQL_COMENTARIOS = `
  SELECT c.id AS "id", c.demanda_id AS "demandaId", c.usuario_id AS "usuarioId",
         u.nome AS "autor", c.texto AS "texto", c.data_hora AS "data"
    FROM comentario c
    JOIN usuario u ON u.id = c.usuario_id`;

interface ComentarioGravado {
  id: number;
  demandaId: number;
  usuarioId: number;
  autor: string;
  texto: string;
  data: Date;
}

interface RegistroDeHistorico {
  id: number;
  demandaId: number;
  usuarioId: number;
  autor: string;
  descricao: string;
  data: Date;
}


async function listarComentarios(demandaId: number): Promise<ComentarioGravado[]> {
  const resultado = await executar<ComentarioGravado>(
    `${SQL_COMENTARIOS} WHERE c.demanda_id = :demandaId ORDER BY c.data_hora, c.id`,
    { demandaId }
  );
  return resultado.rows ?? [];
}

async function buscarComentario(id: number): Promise<ComentarioGravado | undefined> {
  const resultado = await executar<ComentarioGravado>(`${SQL_COMENTARIOS} WHERE c.id = :id`, { id });
  return resultado.rows?.[0];
}

async function listarHistorico(demandaId: number): Promise<RegistroDeHistorico[]> {
  const resultado = await executar<RegistroDeHistorico>(
    `SELECT h.id AS "id", h.demanda_id AS "demandaId", h.usuario_id AS "usuarioId",
            u.nome AS "autor", h.descricao AS "descricao", h.data_hora AS "data"
       FROM historico h
       JOIN usuario u ON u.id = h.usuario_id
      WHERE h.demanda_id = :demandaId
      ORDER BY h.data_hora, h.id`,
    { demandaId }
  );
  return resultado.rows ?? [];
}

async function inserirComentario(demandaId: number, usuarioId: number, texto: string): Promise<number> {
  const insercao = await executar(
    `INSERT INTO comentario (demanda_id, usuario_id, texto)
     VALUES (:demandaId, :usuarioId, :texto)
     RETURNING id INTO :id`,
    { demandaId, usuarioId, texto, id: SAIDA_NUMERO }
  );
  return insercao.outBinds.id[0];
}

function listarErrosDoComentario(autor: UsuarioNoProjeto | undefined, texto: string): string[] {
  const erros: string[] = [];
  if (!autor) {
    erros.push("usuarioId deve ser o id de um usuário existente.");
  }
  if (texto.length < COMENTARIO_MIN) {
    erros.push(`texto deve ter pelo menos ${COMENTARIO_MIN} caracteres.`);
  }
  if (texto.length > COMENTARIO_MAX) {
    erros.push(`texto deve ter no máximo ${COMENTARIO_MAX} caracteres.`);
  }
  return erros;
}

async function registrarComentario(idDaUrl: unknown, corpo: unknown): Promise<ComentarioGravado | undefined> {
  const demanda = await buscarDemandaDaUrl(idDaUrl);
  const dados = exigirObjetoJson(corpo);
  const autor = await buscarAutor(dados.usuarioId, demanda.projetoId);
  const texto = lerTexto(dados.texto) ?? "";
  const erros = listarErrosDoComentario(autor, texto);
  if (!autor || erros.length > 0) {
    throw new ErroDeRequisicao(400, "Dados inválidos", erros);
  }
  if (!temAcessoAoProjeto(autor)) {
    throw new ErroDeRequisicao(403, "O usuário não está vinculado ao projeto desta demanda.");
  }
  return buscarComentario(await inserirComentario(demanda.id, autor.id, texto));
}


// Só mostra a demanda para quem tem acesso ao projeto dela (o Administrador vê todas)
async function buscarDemandaVisivel(idDaUrl: unknown, usuarioId: unknown): Promise<DemandaGravada> {
  const usuario = await exigirUsuario(usuarioId);
  const demanda = await buscarDemandaDaUrl(idDaUrl);
  const noProjeto = await buscarUsuario(usuario.id, demanda.projetoId);
  if (!noProjeto || !temAcessoAoProjeto(noProjeto)) {
    throw new ErroDeRequisicao(403, "O usuário não está vinculado ao projeto desta demanda.");
  }
  return demanda;
}


router.get("/demandas/:id", comTratamentoDeErros(async function (req: Request, res: Response) {
  res.status(200).json({ demanda: await buscarDemandaVisivel(req.params.id, req.query.usuarioId) });
}));

router.get("/demandas/:id/comentarios", comTratamentoDeErros(async function (req: Request, res: Response) {
  const demanda = await buscarDemandaVisivel(req.params.id, req.query.usuarioId);
  const comentarios = await listarComentarios(demanda.id);
  res.status(200).json({ total: comentarios.length, comentarios });
}));

router.post("/demandas/:id/comentarios", comTratamentoDeErros(async function (req: Request, res: Response) {
  res.status(201).json({ comentario: await registrarComentario(req.params.id, req.body) });
}));

router.get("/demandas/:id/historico", comTratamentoDeErros(async function (req: Request, res: Response) {
  const demanda = await buscarDemandaVisivel(req.params.id, req.query.usuarioId);
  const historico = await listarHistorico(demanda.id);
  res.status(200).json({ total: historico.length, historico });
}));

export default router;
