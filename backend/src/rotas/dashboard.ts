/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Rota do dashboard: GET /dashboard?usuarioId=N
 * Lê os indicadores do banco Oracle. O Administrador vê todos os projetos;
 * Líder e Membro contam só as demandas dos projetos a que estão vinculados.
 *
 * Critérios da equipe:
 *   - "Em aberto": não está Concluída nem Cancelada.
 *   - "Próximas do prazo": em aberto, com prazo, vencendo nos próximos 7 dias
 *     (as vencidas também entram). Dá para trocar com ?dias=N.
 */

import { Router, Request, Response } from "express";
import { executar } from "../bd";
import { TIPOS, PRIORIDADES, STATUS } from "../tipos";
import { ADMINISTRADOR, ErroDeRequisicao, comTratamentoDeErros, exigirUsuario } from "./apoioDemandas";

const router = Router();

const DIAS_ALERTA = 7;

const STATUS_ENCERRADOS = { concluida: "Concluída", cancelada: "Cancelada" };

// Condição que deixa só as demandas dos projetos vinculados ao usuário
const SQL_VINCULO = "d.projeto_id IN (SELECT up.projeto_id FROM usuario_projeto up WHERE up.usuario_id = :usuarioId)";

// Filtro de cada consulta: o Administrador não tem filtro ("1 = 1").
// O id entra como variável de ligação, só quando aparece no SQL (o driver recusa sobras).
interface Filtro {
  sql: string;
  valores: { usuarioId?: number };
}

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
async function contarPor(coluna: "status" | "prioridade" | "tipo", valores: string[], filtro: Filtro) {
  // a coluna vem só dessas três opções, nunca do usuário
  const resultado = await executar<{ valor: string; quantidade: number }>(
    `SELECT d.${coluna} AS "valor", COUNT(*) AS "quantidade"
       FROM demanda d
      WHERE ${filtro.sql}
      GROUP BY d.${coluna}`,
    filtro.valores
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


router.get("/dashboard", comTratamentoDeErros(async function (req: Request, res: Response) {
  // Sem usuário identificado (ou com um id que não existe) a resposta é 401
  const usuario = await exigirUsuario(req.query.usuarioId);
  const filtro: Filtro = usuario.perfil === ADMINISTRADOR
    ? { sql: "1 = 1", valores: {} }
    : { sql: SQL_VINCULO, valores: { usuarioId: usuario.id } };

  let diasAlerta = DIAS_ALERTA;

  if (req.query.dias !== undefined) {
    const texto = req.query.dias;
    const numero = Number(texto);

    if (typeof texto !== "string" || texto.trim() === "" || !Number.isInteger(numero) || numero < 0) {
      throw new ErroDeRequisicao(400, "O parâmetro 'dias' deve ser um número inteiro maior ou igual a zero");
    }

    diasAlerta = numero;
  }

  const resultadoTotal = await executar<{ total: number }>(
    `SELECT COUNT(*) AS "total" FROM demanda d WHERE ${filtro.sql}`,
    filtro.valores
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
        AND ${filtro.sql}
      ORDER BY d.id`,
    { prioridade: "Crítica", ...STATUS_ENCERRADOS, ...filtro.valores }
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
        AND ${filtro.sql}
      ORDER BY d.prazo, d.id`,
    { ...STATUS_ENCERRADOS, dias: diasAlerta, ...filtro.valores }
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
    porStatus: await contarPor("status", STATUS, filtro),
    porPrioridade: await contarPor("prioridade", PRIORIDADES, filtro),
    porTipo: await contarPor("tipo", TIPOS, filtro),
    criticasEmAberto: criticas,
    diasAlerta: diasAlerta,
    proximasDoPrazo: proximasDoPrazo
  });
}));

export default router;