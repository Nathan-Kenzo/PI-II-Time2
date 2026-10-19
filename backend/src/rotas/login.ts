/**
 * Autor: Felipe Oliveira dos Santos
 * Rotas de login e usuários.
 * Responsável por:
 *   - POST /login
 *   - GET /usuarios
 */

import { Router, Request, Response } from "express";
import { usuarios } from "../dados/dadosTeste";

const router = Router();


// funções de apoio

// remove a senha antes de devolver os dados do usuario
function semSenha(usuario: typeof usuarios[number]) {
  const { senha, ...dadosUsuario } = usuario;
  return dadosUsuario;
}


// rotas

router.get("/usuarios", function (req: Request, res: Response) {

  const listaUsuarios = usuarios.map(function (usuario) {
    return semSenha(usuario);
  });

  res.status(200).json(listaUsuarios);
});


router.post("/login", function (req: Request, res: Response) {

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

  const usuario = usuarios.find(function (usuario) {
    return usuario.email === email && usuario.senha === senha;
  });

  if (!usuario) {
    res.status(401).json({
      erro: "Credenciais inválidas"
    });
    return;
  }

  // resposta

  res.status(200).json({
    usuario: semSenha(usuario)
  });
});

export default router;