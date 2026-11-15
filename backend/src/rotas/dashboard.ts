/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Rota do dashboard: GET /dashboard
 * Lê os indicadores do banco Oracle.
 *
 * Critérios da equipe:
 *   - "Em aberto": não está Concluída nem Cancelada.
 *   - "Próximas do prazo": em aberto, com prazo, vencendo nos próximos 7 dias
 *     (as vencidas também entram). Dá para trocar com ?dias=N.
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { TIPOS, PRIORIDADES, STATUS } from "../tipos";

const router = Router();

const DIAS_ALERTA = 7;

const STATUS_ENCERRADOS = { concluida: "Concluída", cancelada: "Cancelada" };

interface LinhaCritica {
  id: number;
  titulo: string;
  projeto: string;
  responsavel: string | null;
  status: string;
}

interface LinhaProxima {
  id: number;
  titulo: string;
  prazo: string;
  vencida: number; // 1 = prazo já passou, 0 = ainda não
  prioridade: string;
  status: string;
}


// Conta as demandas por valor de uma coluna (valores sem demanda ficam com 0)
async function contarPor(coluna: "status" | "prioridade" | "tipo", valores: string[]) {
  // a coluna vem só dessas três opções, nunca do usuário
  const resultado = await executar<{ valor: string; quantidade: number }>(
    `SELECT ${coluna} AS "valor", COUNT(*) AS "quantidade"
       FROM demanda
      GROUP BY ${coluna}`
  );
  const linhas = resultado.rows || [];

  const contagem: { [valor: string]: number } = {};

  for (const valor of valores) {
    const linha = linhas.find(function (item) {
      return item.valor === valor;
    });
    contagem[valor] = linha ? linha.quantidade : 0;
  }

  return contagem;
}


router.get("/dashboard", async function (req: Request, res: Response) {
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

  const resultadoTotal = await executar<{ total: number }>(
    `SELECT COUNT(*) AS "total" FROM demanda`
  );
  const total = resultadoTotal.rows ? resultadoTotal.rows[0].total : 0;

  const resultadoCriticas = await executar<LinhaCritica>(
    `SELECT d.id AS "id", d.titulo AS "titulo", p.nome AS "projeto",
            u.nome AS "responsavel", d.status AS "status"
       FROM demanda d
       JOIN projeto p ON p.id = d.projeto_id
       LEFT JOIN usuario u ON u.id = d.responsavel_id
      WHERE d.prioridade = :prioridade
        AND d.status NOT IN (:concluida, :cancelada)
      ORDER BY d.id`,
    { prioridade: "Crítica", ...STATUS_ENCERRADOS }
  );
  const criticas = resultadoCriticas.rows || [];

  // TRUNC(SYSDATE) é a data de hoje no banco, sem a hora
  const resultadoProximas = await executar<LinhaProxima>(
    `SELECT d.id AS "id", d.titulo AS "titulo",
            TO_CHAR(d.prazo, 'YYYY-MM-DD') AS "prazo",
            CASE WHEN d.prazo < TRUNC(SYSDATE) THEN 1 ELSE 0 END AS "vencida",
            d.prioridade AS "prioridade", d.status AS "status"
       FROM demanda d
      WHERE d.prazo IS NOT NULL
        AND d.status NOT IN (:concluida, :cancelada)
        AND d.prazo <= TRUNC(SYSDATE) + :dias
      ORDER BY d.prazo, d.id`,
    { ...STATUS_ENCERRADOS, dias: diasAlerta }
  );

  const proximasDoPrazo = (resultadoProximas.rows || []).map(function (linha) {
    return {
      id: linha.id,
      titulo: linha.titulo,
      prazo: linha.prazo,
      vencida: linha.vencida === 1,
      prioridade: linha.prioridade,
      status: linha.status
    };
  });

  res.status(200).json({
    total: total,
    porStatus: await contarPor("status", STATUS),
    porPrioridade: await contarPor("prioridade", PRIORIDADES),
    porTipo: await contarPor("tipo", TIPOS),
    criticasEmAberto: criticas,
    diasAlerta: diasAlerta,
    proximasDoPrazo: proximasDoPrazo
  });
});

export default router;