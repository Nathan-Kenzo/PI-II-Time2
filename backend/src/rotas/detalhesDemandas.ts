/**
 * Autor: Henrique Aguiar de Souza Pella
 *
 * Rotas de detalhes da demanda e comentários:
 *   GET  /demandas/:id               dados completos de uma demanda
 *   GET  /demandas/:id/comentarios   comentários da demanda, do mais antigo ao mais novo
 *   POST /demandas/:id/comentarios   registra um comentário
 *
 * As regras são as mesmas da tela (js/permissoes.js e js/demanda.js), repetidas
 * aqui porque a API não confia no que vem do navegador:
 *   - comenta quem enxerga a demanda: Administrador ou usuário vinculado ao projeto;
 *   - o comentário precisa ter pelo menos 3 caracteres;
 *   - a data e hora do comentário são definidas pelo servidor.
 */

import { Router, Request, Response } from "express";
import { usuarios, projetos, demandas, comentarios } from "../dados/dadosTeste";
import { Comentario, Demanda } from "../tipos";

const router = Router();

const COMENTARIO_MIN = 3;


// ---------- Funções de apoio ----------

// Procura a demanda do :id da URL. Se não achar, já responde o erro e devolve undefined
function buscarDemanda(req: Request, res: Response): Demanda | undefined {
  const id = String(req.params.id);

  if (!/^\d+$/.test(id)) {
    res.status(400).json({ erro: "O id da demanda deve ser um número inteiro." });
    return undefined;
  }

  const demanda = demandas.find(function (d) { return d.id === Number(id); });
  if (!demanda) {
    res.status(404).json({ erro: "Demanda não encontrada." });
    return undefined;
  }

  return demanda;
}

function nomeDoUsuario(id: number | null): string | null {
  const usuario = usuarios.find(function (u) { return u.id === id; });
  return usuario ? usuario.nome : null;
}

// Acrescenta o nome do autor, para a tela não precisar buscar a lista de usuários
function comAutor(comentario: Comentario) {
  return { ...comentario, autor: nomeDoUsuario(comentario.usuarioId) };
}


// ---------- GET /demandas/:id ----------

router.get("/demandas/:id", function (req: Request, res: Response) {
  const demanda = buscarDemanda(req, res);
  if (!demanda) {
    return;
  }

  const projeto = projetos.find(function (p) { return p.id === demanda.projetoId; });

  res.status(200).json({
    demanda: {
      ...demanda,
      projeto: projeto ? projeto.nome : null,
      responsavel: nomeDoUsuario(demanda.responsavelId)
    }
  });
});


// ---------- GET /demandas/:id/comentarios ----------

router.get("/demandas/:id/comentarios", function (req: Request, res: Response) {
  const demanda = buscarDemanda(req, res);
  if (!demanda) {
    return;
  }

  const lista = comentarios
    .filter(function (c) { return c.demandaId === demanda.id; })
    .map(comAutor);

  res.status(200).json({ total: lista.length, comentarios: lista });
});


// ---------- POST /demandas/:id/comentarios ----------

router.post("/demandas/:id/comentarios", function (req: Request, res: Response) {
  const demanda = buscarDemanda(req, res);
  if (!demanda) {
    return;
  }

  const corpo = req.body;
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    res.status(400).json({ erro: "Corpo da requisição deve ser um objeto JSON." });
    return;
  }

  const erros: string[] = [];

  // ponytail: o autor vem no corpo porque ainda não há sessão de login.
  // Quando houver, ele passa a ser o usuário logado e este campo sai.
  // Aceita o id como número (3) ou texto ("3"); true, [3] ou "3.0" não valem
  const idInformado = typeof corpo.usuarioId === "string" ? corpo.usuarioId.trim() : corpo.usuarioId;
  const usuario = usuarios.find(function (u) { return u.id === idInformado || String(u.id) === idInformado; });
  if (!usuario) {
    erros.push("usuarioId deve ser o id de um usuário existente.");
  }

  const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
  if (texto.length < COMENTARIO_MIN) {
    erros.push("texto deve ter pelo menos " + COMENTARIO_MIN + " caracteres.");
  }

  if (erros.length > 0) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    return;
  }

  // Mesma regra de podeComentar() da tela: só comenta quem enxerga a demanda
  if (usuario!.perfil !== "Administrador" && !usuario!.projetos.includes(demanda.projetoId)) {
    res.status(403).json({ erro: "O usuário não está vinculado ao projeto desta demanda." });
    return;
  }

  const novo: Comentario = {
    id: comentarios.reduce(function (maior, c) { return c.id > maior ? c.id : maior; }, 0) + 1,
    demandaId: demanda.id,
    usuarioId: usuario!.id,
    texto: texto,
    data: new Date().toISOString()
  };

  comentarios.push(novo);

  res.status(201).json({ comentario: comAutor(novo) });
});

export default router;
