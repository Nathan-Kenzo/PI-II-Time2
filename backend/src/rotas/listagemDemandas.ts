/**
 * Autor: Nathan Kenzo Puzipe
 *
 * Rota da listagem de demandas (filtros, busca e ordenação).
 *
 */

import { Router, Request, Response } from "express";
import { usuarios, projetos, demandas } from "../dados/dadosTeste";
import { TIPOS, PRIORIDADES, STATUS, Demanda } from "../tipos";

const router = Router();

// Campos aceitos na ordenação
const CAMPOS_ORDENACAO: string[] = ["prioridade", "dataCriacao", "prazo", "status"];

// Mesmas regras de tamanho da busca usadas na tela (js/validacoes.js)
const BUSCA_MIN = 2;
const BUSCA_MAX = 100;

// Remove acentos e maiúsculas, para a busca e os filtros não dependerem disso
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Procura o valor oficial na lista ("em revisao" vira "Em revisão"). Se não existir, devolve undefined
function acharValor(entrada: string, lista: string[]): string | undefined {
  return lista.find(function (valor) {
    return normalizar(valor) === normalizar(entrada);
  });
}

// Lê um parâmetro da URL como texto.
// Devolve undefined se não veio (ou veio vazio) e null se veio repetido (?a=1&a=2)
function lerParametro(valor: unknown): string | undefined | null {
  if (valor === undefined) {
    return undefined;
  }
  if (typeof valor !== "string") {
    return null;
  }
  const texto = valor.trim();
  return texto === "" ? undefined : texto;
}

router.get("/demandas", function (req: Request, res: Response) {
  const erros: string[] = [];

  // ---------- 1) Leitura dos parâmetros ----------
  const parametros = {
    status: lerParametro(req.query.status),
    prioridade: lerParametro(req.query.prioridade),
    tipo: lerParametro(req.query.tipo),
    projeto: lerParametro(req.query.projeto),
    responsavel: lerParametro(req.query.responsavel),
    busca: lerParametro(req.query.busca),
    ordenarPor: lerParametro(req.query.ordenarPor),
    ordem: lerParametro(req.query.ordem)
  };

  for (const nome of Object.keys(parametros)) {
    if ((parametros as Record<string, string | undefined | null>)[nome] === null) {
      erros.push('O parâmetro "' + nome + '" deve ser informado uma única vez.');
    }
  }

  // ---------- 2) Validação (a API não confia nas validações da tela) ----------
  const status = parametros.status ? acharValor(parametros.status, STATUS) : undefined;
  if (parametros.status && !status) {
    erros.push("status inválido. Valores aceitos: " + STATUS.join(", ") + ".");
  }

  const prioridade = parametros.prioridade ? acharValor(parametros.prioridade, PRIORIDADES) : undefined;
  if (parametros.prioridade && !prioridade) {
    erros.push("prioridade inválida. Valores aceitos: " + PRIORIDADES.join(", ") + ".");
  }

  const tipo = parametros.tipo ? acharValor(parametros.tipo, TIPOS) : undefined;
  if (parametros.tipo && !tipo) {
    erros.push("tipo inválido. Valores aceitos: " + TIPOS.join(", ") + ".");
  }

  let projetoId: number | undefined;
  if (parametros.projeto) {
    if (/^\d+$/.test(parametros.projeto)) {
      projetoId = Number(parametros.projeto);
    } else {
      erros.push("projeto deve ser o id numérico do projeto.");
    }
  }

  // responsavel pode ser um id ou a palavra "sem" (demandas sem responsável)
  let responsavelId: number | undefined;
  let semResponsavel = false;
  if (parametros.responsavel) {
    if (normalizar(parametros.responsavel) === "sem") {
      semResponsavel = true;
    } else if (/^\d+$/.test(parametros.responsavel)) {
      responsavelId = Number(parametros.responsavel);
    } else {
      erros.push('responsavel deve ser o id numérico do usuário ou "sem".');
    }
  }

  if (parametros.busca) {
    if (parametros.busca.length < BUSCA_MIN) {
      erros.push("busca deve ter pelo menos " + BUSCA_MIN + " caracteres.");
    } else if (parametros.busca.length > BUSCA_MAX) {
      erros.push("busca deve ter no máximo " + BUSCA_MAX + " caracteres.");
    }
  }

  const ordenarPor = parametros.ordenarPor ? acharValor(parametros.ordenarPor, CAMPOS_ORDENACAO) : undefined;
  if (parametros.ordenarPor && !ordenarPor) {
    erros.push("ordenarPor inválido. Valores aceitos: " + CAMPOS_ORDENACAO.join(", ") + ".");
  }

  const ordemInformada = parametros.ordem ? normalizar(parametros.ordem) : undefined;
  if (ordemInformada && ordemInformada !== "asc" && ordemInformada !== "desc") {
    erros.push('ordem inválida. Valores aceitos: "asc" ou "desc".');
  }

  if (erros.length > 0) {
    res.status(400).json({ erro: "Parâmetros inválidos", detalhes: erros });
    return;
  }

  // ---------- 3) Filtros (a demanda precisa atender a todos os informados) ----------
  let resultado: Demanda[] = demandas.filter(function (demanda) {
    if (status && demanda.status !== status) return false;
    if (prioridade && demanda.prioridade !== prioridade) return false;
    if (tipo && demanda.tipo !== tipo) return false;
    if (projetoId !== undefined && demanda.projetoId !== projetoId) return false;
    if (responsavelId !== undefined && demanda.responsavelId !== responsavelId) return false;
    if (semResponsavel && demanda.responsavelId !== null) return false;
    return true;
  });

  // ---------- 4) Busca textual por título ou descrição ----------
  if (parametros.busca) {
    const termo = normalizar(parametros.busca);
    resultado = resultado.filter(function (demanda) {
      return normalizar(demanda.titulo).includes(termo) || normalizar(demanda.descricao).includes(termo);
    });
  }

  // ---------- 5) Ordenação ----------
  // Prioridade e status seguem a ordem das listas de tipos.ts:
  // em "asc", Crítica vem primeiro e Aberta vem antes de Concluída.
  const campo = ordenarPor || "dataCriacao";
  const ordem = ordemInformada || (campo === "dataCriacao" ? "desc" : "asc");
  const sinal = ordem === "asc" ? 1 : -1;

  resultado = resultado.slice().sort(function (a, b) {
    let comparacao = 0;

    if (campo === "prioridade") {
      comparacao = PRIORIDADES.indexOf(a.prioridade) - PRIORIDADES.indexOf(b.prioridade);
    } else if (campo === "status") {
      comparacao = STATUS.indexOf(a.status) - STATUS.indexOf(b.status);
    } else if (campo === "dataCriacao") {
      comparacao = Date.parse(a.dataCriacao) - Date.parse(b.dataCriacao);
    } else if (campo === "prazo") {
      // Demandas sem prazo ficam sempre no fim, tanto em asc quanto em desc
      if (a.prazo === null && b.prazo === null) return a.id - b.id;
      if (a.prazo === null) return 1;
      if (b.prazo === null) return -1;
      comparacao = Date.parse(a.prazo) - Date.parse(b.prazo);
    }

    // Em caso de empate, mantém uma ordem estável pelo id
    return comparacao !== 0 ? comparacao * sinal : a.id - b.id;
  });

  // ---------- 6) Resposta (com os nomes do projeto e do responsável) ----------
  const lista = resultado.map(function (demanda) {
    const projeto = projetos.find(function (p) { return p.id === demanda.projetoId; });
    const responsavel = usuarios.find(function (u) { return u.id === demanda.responsavelId; });

    return {
      id: demanda.id,
      titulo: demanda.titulo,
      tipo: demanda.tipo,
      prioridade: demanda.prioridade,
      status: demanda.status,
      projeto: projeto ? projeto.nome : null,
      responsavel: responsavel ? responsavel.nome : null,
      dataCriacao: demanda.dataCriacao,
      prazo: demanda.prazo
    };
  });

  res.status(200).json({
    total: lista.length,
    ordenacao: { campo: campo, ordem: ordem },
    demandas: lista
  });
});

export default router;
