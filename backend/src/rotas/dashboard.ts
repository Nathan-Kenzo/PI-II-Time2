/**
 * Autor: [Felipe Oliveira Barbosa]
 *
 * Rota do dashboard: GET /dashboard
 *
 * Devolve os indicadores da tela inicial:
 *   - total de demandas
 *   - quantidade por status, por prioridade e por tipo
 *   - demandas críticas em aberto
 *   - demandas próximas do prazo
 *
 * Critérios adotados pela equipe:
 *   - "Em aberto": demanda que não está Concluída nem Cancelada.
 *   - "Próximas do prazo": demandas em aberto, com prazo preenchido, que vencem
 *     nos próximos 7 dias. Prazos que já passaram também entram, marcados como
 *     vencidos. O número de dias pode ser trocado com ?dias=N na URL.
 */

import { Router, Request, Response } from "express";
import { demandas, projetos, usuarios } from "../dados/dadosTeste";
import { Demanda, TIPOS, PRIORIDADES, STATUS } from "../tipos";

const router = Router();

// Quantos dias à frente uma demanda entra em "próximas do prazo"
const DIAS_ALERTA = 7;


// ---------- Funções de apoio ----------

// Em aberto = ainda não foi concluída nem cancelada
function estaEmAberto(demanda: Demanda): boolean {
  return demanda.status !== "Concluída" && demanda.status !== "Cancelada";
}

// "2026-09-25" vira uma data (sem mexer com fuso horário)
function converterData(texto: string): Date {
  const partes = texto.split("-");
  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
}

// Conta quantas demandas existem para cada valor de um campo.
// Valores sem nenhuma demanda aparecem com 0.
function contarPor(lista: Demanda[], campo: "status" | "prioridade" | "tipo", valores: string[]) {
  const contagem: { [valor: string]: number } = {};

  for (const valor of valores) {
    contagem[valor] = lista.filter(function (demanda) {
      return demanda[campo] === valor;
    }).length;
  }

  return contagem;
}

function nomeDoProjeto(id: number): string {
  const projeto = projetos.find(function (item) { return item.id === id; });
  return projeto ? projeto.nome : "-";
}

// Demanda sem responsável devolve null
function nomeDoResponsavel(id: number | null): string | null {
  if (id === null) {
    return null;
  }
  const usuario = usuarios.find(function (item) { return item.id === id; });
  return usuario ? usuario.nome : null;
}


// ---------- Rota ----------

router.get("/dashboard", function (req: Request, res: Response) {
  // dias de alerta: padrão 7, ou o valor informado em ?dias=
  let diasAlerta = DIAS_ALERTA;

  if (req.query.dias !== undefined) {
    const texto = req.query.dias;
    const numero = Number(texto);

    if (typeof texto !== "string" || texto.trim() === "" || !Number.isInteger(numero) || numero < 0) {
      res.status(400).json({ erro: "O parâmetro 'dias' deve ser um número inteiro maior ou igual a zero" });
      return;
    }

    diasAlerta = numero;
  }

  // críticas em aberto
  const criticas = demandas.filter(function (demanda) {
    return demanda.prioridade === "Crítica" && estaEmAberto(demanda);
  }).map(function (demanda) {
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      projeto: nomeDoProjeto(demanda.projetoId),
      responsavel: nomeDoResponsavel(demanda.responsavelId),
      status: demanda.status
    };
  });

  // próximas do prazo (inclui as vencidas)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + diasAlerta);

  const proximas = demandas.filter(function (demanda) {
    return demanda.prazo !== null && estaEmAberto(demanda) && converterData(demanda.prazo) <= limite;
  });

  // as mais urgentes primeiro
  proximas.sort(function (a, b) {
    return converterData(a.prazo as string).getTime() - converterData(b.prazo as string).getTime();
  });

  const proximasDoPrazo = proximas.map(function (demanda) {
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      prazo: demanda.prazo,
      vencida: converterData(demanda.prazo as string) < hoje,
      prioridade: demanda.prioridade,
      status: demanda.status
    };
  });

  res.status(200).json({
    total: demandas.length,
    porStatus: contarPor(demandas, "status", STATUS),
    porPrioridade: contarPor(demandas, "prioridade", PRIORIDADES),
    porTipo: contarPor(demandas, "tipo", TIPOS),
    criticasEmAberto: criticas,
    diasAlerta: diasAlerta,
    proximasDoPrazo: proximasDoPrazo
  });
});

export default router;
