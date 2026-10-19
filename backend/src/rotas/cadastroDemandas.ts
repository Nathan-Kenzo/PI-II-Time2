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
 */

import { Router, Request, Response } from "express";
import { usuarios, projetos, demandas } from "../dados/dadosTeste";
import { TIPOS, PRIORIDADES, Demanda, Tipo, Prioridade } from "../tipos";

const router = Router();

const TITULO_MIN = 5;
const TITULO_MAX = 150;
const DESCRICAO_MIN = 10;

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


// ---------- GET /projetos ----------

router.get("/projetos", function (req: Request, res: Response) {
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
  const projeto = projetoId !== undefined ? projetos.find(function (p) { return p.id === projetoId; }) : undefined;
  if (!projeto) {
    erros.push("projetoId deve ser o id de um projeto existente.");
  }

  // ---------- 2) Campos opcionais ----------
  // Responsável pode ficar em branco na criação (item 2.2.5 do documento)
  let responsavelId: number | null = null;
  if (corpo.responsavelId !== undefined && corpo.responsavelId !== null && corpo.responsavelId !== "") {
    responsavelId = lerId(corpo.responsavelId) ?? -1;
    const responsavel = usuarios.find(function (u) { return u.id === responsavelId; });
    if (!responsavel) {
      erros.push("responsavelId deve ser o id de um usuário existente.");
    } else if (projeto && responsavel.perfil !== "Administrador" && !responsavel.projetos.includes(projeto.id)) {
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

  // ---------- 3) Criação ----------
  const agora = new Date().toISOString();
  const proximoId = demandas.reduce(function (maior, d) { return d.id > maior ? d.id : maior; }, 0) + 1;

  const nova: Demanda = {
    id: proximoId,
    titulo: titulo as string,
    descricao: descricao as string,
    tipo: tipo as Tipo,
    prioridade: prioridade as Prioridade,
    status: "Aberta",            // toda demanda nasce Aberta (item 2.2.3)
    projetoId: projetoId as number,
    responsavelId: responsavelId,
    dataCriacao: agora,          // registrada automaticamente
    dataAtualizacao: agora,
    prazo: prazo
  };

  demandas.push(nova);

  // ponytail: o registro "criou a demanda" no histórico e a checagem de perfil
  // (Membro da Equipe não cria demanda) entram quando houver login e a lista de
  // histórico na camada de dados.

  res.status(201).json({ demanda: nova, aviso: avisoPrazo });
});

export default router;
