/**
 * Autor: Felipe Oliveira dos Santos
 * Rotas de login e usuários.
 * Responsável por:
 *   - POST /login     { email, senha }  ->  { usuario: { id, nome, email, perfil, projetos } }
 *   - GET /usuarios   lista id, nome e perfil (com ?projetoId=N, só os vinculados ao projeto)
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { conferirSenha } from "../senha";
import { ADMINISTRADOR, ErroDeRequisicao, comTratamentoDeErros, lerTexto, lerId, exigirObjetoJson } from "./apoioDemandas";

type UsuarioLogin = {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: string;
};

const router = Router();


// rotas

// Lista de usuários para escolher o responsável da demanda (sem e-mail e sem senha).
// O Administrador não é vinculado a projetos, por isso não aparece quando vem ?projetoId.
router.get("/usuarios", comTratamentoDeErros(async function (req: Request, res: Response) {
  let resultado;

  if (req.query.projetoId === undefined) {
    resultado = await executar(
      `SELECT id AS "id", nome AS "nome", perfil AS "perfil"
         FROM usuario
        ORDER BY nome`
    );
  } else {
    const projetoId = lerId(req.query.projetoId);
    if (projetoId === undefined) {
      throw new ErroDeRequisicao(400, "Parâmetros inválidos", ["projetoId deve ser o id numérico do projeto."]);
    }
    resultado = await executar(
      `SELECT u.id AS "id", u.nome AS "nome", u.perfil AS "perfil"
         FROM usuario u
        WHERE u.id IN (SELECT up.usuario_id FROM usuario_projeto up WHERE up.projeto_id = :projetoId)
        ORDER BY u.nome`,
      { projetoId }
    );
  }

  const usuarios = resultado.rows ?? [];
  res.status(200).json({ total: usuarios.length, usuarios: usuarios });
}));


router.post("/login", comTratamentoDeErros(async function (req: Request, res: Response) {
  const erros: string[] = [];

  // leitura dos dados (o cadastro grava o e-mail em minúsculas)

  const dados = exigirObjetoJson(req.body);
  const email = (lerTexto(dados.email) ?? "").toLowerCase();
  const senha = typeof dados.senha === "string" ? dados.senha : "";

  // validação

  if (!email) {
    erros.push("O campo e-mail é obrigatório.");
  }

  if (!senha) {
    erros.push("O campo senha é obrigatório.");
  }

  if (erros.length > 0) {
    throw new ErroDeRequisicao(400, "Dados inválidos", erros);
  }

  // verificação das credenciais

  const resultado = await executar<UsuarioLogin>(
    `SELECT id     AS "id",
            nome   AS "nome",
            email  AS "email",
            senha  AS "senha",
            perfil AS "perfil"
       FROM usuario
      WHERE email = :email`,
    { email }
  );

  const usuario = resultado.rows?.[0];

  if (!usuario || !conferirSenha(senha, usuario.senha)) {
    throw new ErroDeRequisicao(401, "Credenciais inválidas");
  }

  // projetos vinculados (o Administrador vê todos, por isso a lista fica vazia)

  let projetos: number[] = [];
  if (usuario.perfil !== ADMINISTRADOR) {
    const vinculos = await executar<{ projetoId: number }>(
      `SELECT projeto_id AS "projetoId" FROM usuario_projeto WHERE usuario_id = :id ORDER BY projeto_id`,
      { id: usuario.id }
    );
    projetos = (vinculos.rows ?? []).map(function (linha) {
      return linha.projetoId;
    });
  }

  // resposta (sem a senha)

  res.status(200).json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      projetos: projetos
    }
  });
}));

export default router;
