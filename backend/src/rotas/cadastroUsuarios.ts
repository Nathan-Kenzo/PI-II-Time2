/**
 * Autor: Pedro Tiezo Sales Shimizu
 *
 * Cadastro de usuário pela tela de cadastro.
 *
 *   POST /usuarios   { nome, email, senha }
 *     201  { usuario: { id, nome, email, perfil } }
 *     400  { erro, detalhes }   dados inválidos
 *     409  { erro }             e-mail já cadastrado
 *
 * A senha é gravada como hash (backend/src/senha.ts), nunca em texto puro.
 * Todo usuário novo entra como Membro da Equipe e sem projeto vinculado: o
 * perfil e os vínculos são definidos direto no banco pelo administrador.
 */

import { Router, Request, Response } from "express";
import { executar, SAIDA_NUMERO } from "../bd";
import { gerarHash } from "../senha";
import { ErroDeRequisicao, comTratamentoDeErros, lerTexto, exigirObjetoJson } from "./apoioDemandas";

const router = Router();

const PERFIL_INICIAL = "Membro da Equipe";

const NOME_MIN = 5;
const NOME_MAX = 100;
const EMAIL_MAX = 150;
const SENHA_MIN = 8;
const SENHA_MAX = 200;

// Código do Oracle para violação de chave única (aqui, o e-mail repetido)
const ORA_CHAVE_DUPLICADA = 1;

// Mesmas regras da tela (js/cadastro.js), repetidas aqui porque a requisição
// pode chegar direto na API, sem passar pela tela.
function listarErros(nome: string, email: string, senha: string): string[] {
  const erros: string[] = [];
  if (nome.length < NOME_MIN || nome.length > NOME_MAX) {
    erros.push(`O nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres.`);
  }
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erros.push("Informe um endereço de e-mail válido.");
  }
  const senhaForte = /[A-Z]/.test(senha) && /[a-z]/.test(senha) && /[0-9]/.test(senha);
  if (senha.length < SENHA_MIN || senha.length > SENHA_MAX || !senhaForte) {
    erros.push(`A senha deve ter pelo menos ${SENHA_MIN} caracteres, com letra maiúscula, minúscula e número.`);
  }
  return erros;
}

router.post("/usuarios", comTratamentoDeErros(async function (req: Request, res: Response) {
  const dados = exigirObjetoJson(req.body);
  const nome = lerTexto(dados.nome) ?? "";
  const email = (lerTexto(dados.email) ?? "").toLowerCase();
  const senha = typeof dados.senha === "string" ? dados.senha : "";

  const erros = listarErros(nome, email, senha);
  if (erros.length > 0) {
    throw new ErroDeRequisicao(400, "Dados inválidos", erros);
  }

  try {
    const insercao = await executar(
      `INSERT INTO usuario (nome, email, senha, perfil)
       VALUES (:nome, :email, :senha, :perfil)
       RETURNING id INTO :id`,
      { nome, email, senha: gerarHash(senha), perfil: PERFIL_INICIAL, id: SAIDA_NUMERO }
    );
    res.status(201).json({ usuario: { id: insercao.outBinds.id[0], nome, email, perfil: PERFIL_INICIAL } });
  } catch (erro) {
    if ((erro as { errorNum?: number }).errorNum === ORA_CHAVE_DUPLICADA) {
      throw new ErroDeRequisicao(409, "Já existe um usuário cadastrado com este e-mail.");
    }
    throw erro;
  }
}));

export default router;
