/**
 * Autor: Pedro Tiezo Sales Shimizu
 *
 * Conexão com o banco de dados Oracle, compartilhada por todas as rotas.
 *
 * Como usar em um arquivo de rota:
 *
 *   import { executar } from "../bd";
 *
 *   const resultado = await executar(
 *     `SELECT id AS "id", nome AS "nome" FROM projeto WHERE id = :id`,
 *     { id: 1 }
 *   );
 *   const linhas = resultado.rows;   // [{ id: 1, nome: "DemandaTrack" }]
 *
 * Os valores entram sempre por variáveis de ligação (:id), nunca concatenados
 * no texto do SQL. É isso que impede a injeção de SQL.
 *
 * O apelido entre aspas (AS "id") faz o Oracle devolver o nome da coluna em
 * minúsculas, igual aos campos que a API devolve; sem ele viria "ID".
 */

import oracledb from "oracledb";

// Lê usuário, senha e endereço do arquivo backend/.env (modelo em .env.example).
// O .env não vai para o repositório, por isso a senha não aparece no código.
process.loadEnvFile();

// Cada linha vem como objeto { coluna: valor } em vez de lista de valores
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Cada comando é confirmado (COMMIT) assim que executa
// Limitação: sem transação entre comandos. Se uma rota precisar gravar duas
// tabelas de forma atômica, pegar uma conexão do pool e confirmar no final.
oracledb.autoCommit = true;

// O pool mantém conexões abertas e as reaproveita entre as requisições.
// É criado na primeira consulta e fica guardado nesta variável.
let pool: Promise<oracledb.Pool> | undefined;

function obterPool(): Promise<oracledb.Pool> {
  if (!pool) {
    pool = oracledb.createPool({
      user: process.env.BD_USUARIO,
      password: process.env.BD_SENHA,
      connectString: process.env.BD_CONEXAO
    });
  }
  return pool;
}

// Executa um comando SQL e devolve o resultado do driver:
//   resultado.rows      linhas de um SELECT
//   resultado.outBinds  valores devolvidos por RETURNING ... INTO
// A conexão volta para o pool mesmo quando o comando dá erro.
export async function executar<T = any>(
  sql: string,
  valores: oracledb.BindParameters = {}
): Promise<oracledb.Result<T>> {
  const conexao = await (await obterPool()).getConnection();
  try {
    return await conexao.execute<T>(sql, valores);
  } finally {
    await conexao.close();
  }
}

// Usado no RETURNING id INTO :id para receber o id gerado pelo banco
export const SAIDA_NUMERO: oracledb.BindParameter = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
