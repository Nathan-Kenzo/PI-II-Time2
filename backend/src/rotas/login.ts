/**
 * Autor: Felipe Oliveira dos Santos
 * Rotas de login e usuários.
 * Responsável por:
 *   - POST /login
 *   - GET /usuarios
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { conferirSenha } from "../senha";

type UsuarioLogin = {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: string;
};

const router = Router();


// funções de apoio

// remove a senha antes de devolver os dados do usuario
function semSenha(usuario: UsuarioLogin) {
  const { senha, ...dadosUsuario } = usuario;
  return dadosUsuario;
}


// rotas

router.get("/usuarios", async function (req: Request, res: Response) {

  try {
      const resultado = await executar<UsuarioLogin>(
      `
      SELECT
          id     AS "id",
          nome   AS "nome",
          email  AS "email",
          senha  AS "senha",
          perfil AS "perfil"
      FROM usuario
      `
      );

      const usuarios = resultado.rows ?? [];

      res.status(200).json(
        usuarios.map(semSenha)
      );
  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: "Erro interno do servidor"
    });

  }
});


router.post("/login", async function (req: Request, res: Response) {
  try {
      const erros: string[] = [];

      // leitura dos dados

      const email = req.body.email;
      const senha = req.body.senha;

      // validação

      if (!email) {
        erros.push("O campo e-mail é obrigatório.");
      }

      if (!senha) {
        erros.push("O campo senha é obrigatório.");
      }

      if (erros.length > 0) {
        res.status(400).json({
          erro: "Dados inválidos",
          detalhes: erros
        });
        return;
      }

      // verificação das credenciais

      const resultado = await executar<UsuarioLogin>(
    `
    SELECT
        id      AS "id",
        nome    AS "nome",
        email   AS "email",
        senha   AS "senha",
        perfil  AS "perfil"
    FROM usuario
    WHERE email = :email
    `,
    {
        email
    }
    );

    const usuario = resultado.rows?.[0]; // pega o usuario retornado na funcao resultado

      if (!usuario) {
      res.status(401).json({
        erro: "Credenciais inválidas"
      });

      return;
    }

    if (!conferirSenha(senha, usuario.senha)) {
      res.status(401).json({
        erro: "Credenciais inválidas"
      });

      return;
    }
      // resposta

      res.status(200).json({
        usuario: semSenha(usuario)
      });
  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: "Erro interno do servidor"
    });

  }
});

export default router;