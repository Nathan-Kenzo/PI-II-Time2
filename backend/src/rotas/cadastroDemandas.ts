/**
 * Autor: Pedro Tiezo Sales Shimizu
 *
 * Rotas de cadastro de demanda e de projetos:
 *   GET  /projetos   lista os projetos para preencher o select da tela
 *   POST /demandas   cria uma demanda (sempre com status "Aberta")
 *
 * As regras são as mesmas da tela js/demanda.js, repetidas aqui porque a API
 * não confia no que vem do navegador. O prazo é conferido na API externa de
 * feriados nacionais (BrasilAPI), como exige o documento de visão (item 2.2.5).
 *
 * Os dados são lidos e gravados no banco Oracle (ver ../bd.ts). A estrutura das
 * rotas é a mesma da Reunião 4; mudou só a forma de acesso aos dados.
 */

import { Router, Request, Response } from "express";
import { executar, SAIDA_NUMERO } from "../bd";
import { TIPOS, PRIORIDADES } from "../tipos";

const router = Router();

const TITULO_MIN = 5;
const TITULO_MAX = 150;
const DESCRICAO_MIN = 10;
const DESCRICAO_MAX = 2000;

const API_FERIADOS = "https://brasilapi.com.br/api/feriados/v1/";

// Feriados já consultados, por ano, para não chamar a API externa a cada cadastro
const cacheFeriados: { [ano: string]: { date: string; name: string }[] } = {};


// ---------- Funções de apoio ----------

// Remove acentos e maiúsculas: "critica" e "Crítica" passam a ser iguais
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Procura o valor oficial na lista ("documentacao" vira "Documentação")
function acharValor(entrada: string, lista: string[]): string | undefined {
  return lista.find(function (valor) {
    return normalizar(valor) === normalizar(entrada);
  });
}

// Confere se o texto é uma data real no formato AAAA-MM-DD (31/02 é recusado)
function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

// Data de hoje em AAAA-MM-DD, no fuso do servidor
function dataDeHoje(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return hoje.getFullYear() + "-" + mes + "-" + dia;
}

// Consulta a API externa de feriados nacionais para a data informada
async function verificarFeriado(data: string): Promise<{ ehFeriado: boolean; nome: string; indisponivel: boolean }> {
  const ano = data.substring(0, 4);
  try {
    if (!cacheFeriados[ano]) {
      const resposta = await fetch(API_FERIADOS + ano);
      if (!resposta.ok) {
        return { ehFeriado: false, nome: "", indisponivel: true };
      }
      cacheFeriados[ano] = await resposta.json();
    }
    const encontrado = cacheFeriados[ano].find(function (feriado) {
      return feriado.date === data;
    });
    return { ehFeriado: !!encontrado, nome: encontrado ? encontrado.name : "", indisponivel: false };
  } catch (erro) {
    console.warn("Falha ao consultar a API de feriados:", erro);
    return { ehFeriado: false, nome: "", indisponivel: true };
  }
}

// Lê um campo de texto do corpo; devolve undefined se não veio ou não é texto
function lerTexto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor.trim() : undefined;
}

// Lê um id numérico do corpo; aceita número ou texto só com dígitos
function lerId(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isInteger(valor) && valor > 0) {
    return valor;
  }
  if (typeof valor === "string" && /^\d+$/.test(valor.trim())) {
    return Number(valor);
  }
  return undefined;
}

// Busca um usuário no banco e diz se ele está vinculado ao projeto informado.
// Devolve undefined quando o id não existe.
async function buscarUsuario(id: number, projetoId: number | undefined): Promise<{ perfil: string; vinculado: number } | undefined> {
  const resultado = await executar(
    `SELECT u.perfil AS "perfil",
            (SELECT COUNT(*) FROM usuario_projeto up
              WHERE up.usuario_id = u.id AND up.projeto_id = :projetoId) AS "vinculado"
       FROM usuario u
      WHERE u.id = :id`,
    { id: id, projetoId: projetoId ?? null }
  );
  return resultado.rows?.[0];
}

// O Administrador acessa todos os projetos; os demais, só os vinculados
function temAcessoAoProjeto(usuario: { perfil: string; vinculado: number }): boolean {
  return usuario.perfil === "Administrador" || usuario.vinculado > 0;
}


// ---------- GET /projetos ----------

router.get("/projetos", async function (req: Request, res: Response) {
  const resultado = await executar(
    `SELECT id AS "id", nome AS "nome", descricao AS "descricao" FROM projeto ORDER BY id`
  );
  const projetos = resultado.rows ?? [];

  res.status(200).json({ total: projetos.length, projetos: projetos });
});


// ---------- POST /demandas ----------

router.post("/demandas", async function (req: Request, res: Response) {
  const corpo = req.body;

  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    res.status(400).json({ erro: "Corpo da requisição deve ser um objeto JSON." });
    return;
  }

  const erros: string[] = [];

  // ---------- 1) Campos obrigatórios ----------
  const titulo = lerTexto(corpo.titulo);
  if (!titulo || titulo.length < TITULO_MIN) {
    erros.push("titulo deve ter pelo menos " + TITULO_MIN + " caracteres.");
  } else if (titulo.length > TITULO_MAX) {
    erros.push("titulo deve ter no máximo " + TITULO_MAX + " caracteres.");
  }

  const descricao = lerTexto(corpo.descricao);
  if (!descricao || descricao.length < DESCRICAO_MIN) {
    erros.push("descricao deve ter pelo menos " + DESCRICAO_MIN + " caracteres.");
  } else if (descricao.length > DESCRICAO_MAX) {
    erros.push("descricao deve ter no máximo " + DESCRICAO_MAX + " caracteres.");
  }

  const tipoTexto = lerTexto(corpo.tipo);
  const tipo = tipoTexto ? acharValor(tipoTexto, TIPOS) : undefined;
  if (!tipo) {
    erros.push("tipo inválido. Valores aceitos: " + TIPOS.join(", ") + ".");
  }

  const prioridadeTexto = lerTexto(corpo.prioridade);
  const prioridade = prioridadeTexto ? acharValor(prioridadeTexto, PRIORIDADES) : undefined;
  if (!prioridade) {
    erros.push("prioridade inválida. Valores aceitos: " + PRIORIDADES.join(", ") + ".");
  }

  const projetoId = lerId(corpo.projetoId);
  let projetoExiste = false;
  if (projetoId !== undefined) {
    const resultado = await executar(`SELECT id AS "id" FROM projeto WHERE id = :id`, { id: projetoId });
    projetoExiste = (resultado.rows ?? []).length > 0;
  }
  if (!projetoExiste) {
    erros.push("projetoId deve ser o id de um projeto existente.");
  }

  // Quem está criando a demanda. Vai para o histórico e define a permissão.
  // ponytail: o autor vem no corpo porque ainda não há sessão de login.
  // Quando houver, ele passa a ser o usuário logado e este campo sai.
  const usuarioId = lerId(corpo.usuarioId);
  const autor = usuarioId !== undefined ? await buscarUsuario(usuarioId, projetoId) : undefined;
  if (!autor) {
    erros.push("usuarioId deve ser o id de um usuário existente.");
  }

  // ---------- 2) Campos opcionais ----------
  // Responsável pode ficar em branco na criação (item 2.2.5 do documento)
  let responsavelId: number | null = null;
  if (corpo.responsavelId !== undefined && corpo.responsavelId !== null && corpo.responsavelId !== "") {
    responsavelId = lerId(corpo.responsavelId) ?? -1;
    const responsavel = await buscarUsuario(responsavelId, projetoId);
    if (!responsavel) {
      erros.push("responsavelId deve ser o id de um usuário existente.");
    } else if (projetoExiste && !temAcessoAoProjeto(responsavel)) {
      erros.push("O responsável precisa estar vinculado ao projeto da demanda.");
    }
  }

  let prazo: string | null = null;
  let avisoPrazo: string | undefined;
  if (corpo.prazo !== undefined && corpo.prazo !== null && corpo.prazo !== "") {
    const prazoTexto = lerTexto(corpo.prazo);
    if (!prazoTexto || !dataValida(prazoTexto)) {
      erros.push("prazo deve ser uma data válida no formato AAAA-MM-DD.");
    } else if (prazoTexto < dataDeHoje()) {
      erros.push("prazo não pode ser uma data passada.");
    } else {
      // Regra obrigatória: o prazo não pode cair em feriado nacional
      const feriado = await verificarFeriado(prazoTexto);
      if (feriado.ehFeriado) {
        erros.push("prazo cai em um feriado nacional (" + feriado.nome + "). Escolha outra data.");
      } else {
        prazo = prazoTexto;
        if (feriado.indisponivel) {
          avisoPrazo = "A API de feriados estava indisponível; o prazo foi gravado sem essa conferência.";
        }
      }
    }
  }

  if (erros.length > 0) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    return;
  }

  // ---------- 3) Permissão por perfil (item 2.1 do documento) ----------
  // Membro da Equipe não cria demanda; o Líder cria só nos projetos vinculados
  if (autor!.perfil === "Membro da Equipe") {
    res.status(403).json({ erro: "O perfil Membro da Equipe não pode criar demandas." });
    return;
  }
  if (!temAcessoAoProjeto(autor!)) {
    res.status(403).json({ erro: "O usuário não está vinculado ao projeto desta demanda." });
    return;
  }

  // ---------- 4) Gravação no banco ----------
  // Status "Aberta", data de criação e de atualização não são enviados:
  // o próprio banco preenche (DEFAULT das colunas), não importa o que veio no corpo.
  const insercao = await executar(
    `INSERT INTO demanda (titulo, descricao, tipo, prioridade, projeto_id, responsavel_id, prazo)
     VALUES (:titulo, :descricao, :tipo, :prioridade, :projetoId, :responsavelId, TO_DATE(:prazo, 'YYYY-MM-DD'))
     RETURNING id INTO :id`,
    {
      titulo: titulo,
      descricao: descricao,
      tipo: tipo,
      prioridade: prioridade,
      projetoId: projetoId,
      responsavelId: responsavelId,
      prazo: prazo,
      id: SAIDA_NUMERO
    }
  );
  const idCriado: number = insercao.outBinds.id[0];

  // Histórico automático (item 2.2.7): quem criou e quando
  await executar(
    `INSERT INTO historico (demanda_id, usuario_id, descricao) VALUES (:demandaId, :usuarioId, 'criou a demanda.')`,
    { demandaId: idCriado, usuarioId: usuarioId }
  );

  // Lê a demanda de volta, para responder com o que realmente ficou gravado
  const criada = await executar(
    `SELECT id AS "id", titulo AS "titulo", descricao AS "descricao", tipo AS "tipo",
            prioridade AS "prioridade", status AS "status", projeto_id AS "projetoId",
            responsavel_id AS "responsavelId", data_criacao AS "dataCriacao",
            data_atualizacao AS "dataAtualizacao", TO_CHAR(prazo, 'YYYY-MM-DD') AS "prazo"
       FROM demanda
      WHERE id = :id`,
    { id: idCriado }
  );

  res.status(201).json({ demanda: criada.rows?.[0], aviso: avisoPrazo });
});

export default router;
