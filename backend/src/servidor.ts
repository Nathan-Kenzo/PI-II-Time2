/**
 * Autor: [Felipe Oliveira Barbosa]
 *
 * Ponto de entrada do servidor. Configura o Express, registra as rotas
 * e define as respostas padrão de erro (sempre em JSON).
 */

import express, { Request, Response, NextFunction } from "express";
import rotas from "./rotas";

const app = express();
const PORTA = 3000;

// permite ler o corpo das requisições em JSON
app.use(express.json());

// rota simples só para conferir se o servidor está no ar
app.get("/", function (req: Request, res: Response) {
  res.json({ mensagem: "API do DemandaTrack funcionando" });
});

app.use(rotas);

// nenhuma rota respondeu: 404
app.use(function (req: Request, res: Response) {
  res.status(404).json({ erro: "Rota não encontrada" });
});

// tratamento de erros (ex: JSON enviado com formato errado)
app.use(function (erro: unknown, req: Request, res: Response, next: NextFunction) {
  if (erro instanceof SyntaxError) {
    res.status(400).json({ erro: "JSON inválido" });
    return;
  }

  console.error(erro);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

app.listen(PORTA, function () {
  console.log("Servidor rodando em http://localhost:" + PORTA);
});
