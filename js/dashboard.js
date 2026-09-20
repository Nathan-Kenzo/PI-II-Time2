/**
 * Autor: [Felipe Oliveira Barbosa]
 */

// Valores aceitos pelo escopo do sistema
const TIPOS = ["Tarefa", "Defeito", "Melhoria", "Documentação"];
const PRIORIDADES = ["Crítica", "Alta", "Média", "Baixa"];
const STATUS = ["Aberta", "Em andamento", "Em revisão", "Concluída", "Cancelada"];

// Classes do CSS (selos coloridos) para cada status e prioridade
const CLASSE_STATUS = {
  "Aberta": "selo-aberta",
  "Em andamento": "selo-andamento",
  "Em revisão": "selo-revisao",
  "Concluída": "selo-concluida",
  "Cancelada": "selo-cancelada"
};

const CLASSE_PRIORIDADE = {
  "Crítica": "selo-critica",
  "Alta": "selo-alta",
  "Média": "selo-media",
  "Baixa": "selo-baixa"
};

// Quantos dias à frente uma demanda entra em "próximas do prazo"
const DIAS_ALERTA = 7;


const demandas = [
  { titulo: "Corrigir erro no login", tipo: "Defeito", prioridade: "Crítica", status: "Aberta", projeto: "DemandaTrack", responsavel: "Exemplo", prazo: "2026-09-25" },
  { titulo: "Falha ao salvar demanda", tipo: "Defeito", prioridade: "Crítica", status: "Em andamento", projeto: "DemandaTrack", responsavel: "Exemplo", prazo: "2026-09-22" },
  { titulo: "Criar tela de dashboard", tipo: "Tarefa", prioridade: "Alta", status: "Em andamento", projeto: "DemandaTrack", responsavel: "Exemplo", prazo: "2026-09-24" },
  { titulo: "Documentar rotas da API", tipo: "Documentação", prioridade: "Média", status: "Em revisão", projeto: "DemandaTrack", responsavel: "Exemplo", prazo: "2026-09-30" },
  { titulo: "Ajustar espaçamento do menu", tipo: "Melhoria", prioridade: "Baixa", status: "Concluída", projeto: "DemandaTrack", responsavel: "Exemplo", prazo: "2026-08-25" },
  { titulo: "Cadastro duplicado de usuário", tipo: "Defeito", prioridade: "Alta", status: "Cancelada", projeto: "DemandaTrack", responsavel: "", prazo: "" }

  // Para testar uma demanda inválida, tire o comentário da linha abaixo:
  // , { titulo: "", tipo: "Bug", prioridade: "Urgente", status: "Aberta", projeto: "DemandaTrack", responsavel: "", prazo: "2026-02-31" }
];


// ---------- Validações ----------

// Confere se o texto é uma data real no formato AAAA-MM-DD
function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const partes = texto.split("-");
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  // se o dia não existir no mês (ex: 31/02), o Date "corrige" e os valores mudam
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

// Devolve a lista de erros da demanda (lista vazia = demanda válida)
function validarDemanda(demanda) {
  const erros = [];

  if (typeof demanda.titulo !== "string" || demanda.titulo.trim() === "") {
    erros.push("título vazio");
  }
  if (!TIPOS.includes(demanda.tipo)) {
    erros.push("tipo inválido (" + demanda.tipo + ")");
  }
  if (!PRIORIDADES.includes(demanda.prioridade)) {
    erros.push("prioridade inválida (" + demanda.prioridade + ")");
  }
  if (!STATUS.includes(demanda.status)) {
    erros.push("status inválido (" + demanda.status + ")");
  }
  if (typeof demanda.projeto !== "string" || demanda.projeto.trim() === "") {
    erros.push("projeto vazio");
  }

  // o prazo é opcional, mas se vier preenchido tem que ser uma data real
  if (demanda.prazo && !dataValida(demanda.prazo)) {
    erros.push("prazo inválido (" + demanda.prazo + ")");
  }

  return erros;
}


// ---------- Funções de apoio ----------

function converterData(texto) {
  const partes = texto.split("-");
  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
}

// "2026-09-25" vira "25/09/2026"
function formatarData(texto) {
  const partes = texto.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function contar(lista, campo, valor) {
  return lista.filter(function (demanda) {
    return demanda[campo] === valor;
  }).length;
}

// Em aberto = ainda não foi concluída nem cancelada
function estaEmAberto(demanda) {
  return demanda.status !== "Concluída" && demanda.status !== "Cancelada";
}


// ---------- Preenchimento da tela ----------

function preencherNumeros(lista) {
  document.getElementById("num-total").textContent = lista.length;
  document.getElementById("num-abertas").textContent = contar(lista, "status", "Aberta");
  document.getElementById("num-andamento").textContent = contar(lista, "status", "Em andamento");
  document.getElementById("num-revisao").textContent = contar(lista, "status", "Em revisão");
  document.getElementById("num-concluidas").textContent = contar(lista, "status", "Concluída");
  document.getElementById("num-canceladas").textContent = contar(lista, "status", "Cancelada");
}

// Preenche as barras de um card. O rótulo de cada barra ("Alta", "Tarefa"...)
// é usado para saber qual valor contar.
function preencherBarras(idCard, campo, lista) {
  const itens = document.querySelectorAll("#" + idCard + " .barra-item");

  for (const item of itens) {
    const rotulo = item.querySelector(".barra-rotulo").textContent;
    const quantidade = contar(lista, campo, rotulo);

    let porcentagem = 0;
    if (lista.length > 0) {
      porcentagem = (quantidade / lista.length) * 100;
    }

    item.querySelector(".barra-preenchida").style.width = porcentagem + "%";
    item.querySelector(".barra-valor").textContent = quantidade;
  }
}

// Cada linha é uma lista de células. A célula pode ser um texto simples
// ou um objeto { texto, selo } quando precisa do selo colorido.
function preencherTabela(idTabela, linhas, mensagemVazia) {
  const corpo = document.getElementById(idTabela);
  corpo.innerHTML = "";

  if (linhas.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "tabela-vazia";
    td.textContent = mensagemVazia;
    tr.appendChild(td);
    corpo.appendChild(tr);
    return;
  }

  for (const linha of linhas) {
    const tr = document.createElement("tr");

    for (const celula of linha) {
      const td = document.createElement("td");

      if (typeof celula === "string") {
        td.textContent = celula;
      } else {
        const selo = document.createElement("span");
        selo.className = "selo " + celula.selo;
        selo.textContent = celula.texto;
        td.appendChild(selo);
      }

      tr.appendChild(td);
    }

    corpo.appendChild(tr);
  }
}

function preencherCriticas(lista) {
  const criticas = lista.filter(function (demanda) {
    return demanda.prioridade === "Crítica" && estaEmAberto(demanda);
  });

  const linhas = criticas.map(function (demanda) {
    return [
      demanda.titulo,
      demanda.projeto,
      demanda.responsavel || "-",
      { texto: demanda.status, selo: CLASSE_STATUS[demanda.status] }
    ];
  });

  preencherTabela("tabela-criticas", linhas, "Nenhuma demanda crítica em aberto");
}

// Demandas em aberto com prazo dentro dos próximos DIAS_ALERTA dias.
// Prazos que já passaram também entram, marcados como vencidos.
function preencherProximasDoPrazo(lista) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + DIAS_ALERTA);

  const proximas = lista.filter(function (demanda) {
    return demanda.prazo && estaEmAberto(demanda) && converterData(demanda.prazo) <= limite;
  });

  // as mais urgentes primeiro
  proximas.sort(function (a, b) {
    return converterData(a.prazo) - converterData(b.prazo);
  });

  const linhas = proximas.map(function (demanda) {
    let textoPrazo = formatarData(demanda.prazo);
    if (converterData(demanda.prazo) < hoje) {
      textoPrazo += " (vencido)";
    }

    return [
      demanda.titulo,
      textoPrazo,
      { texto: demanda.prioridade, selo: CLASSE_PRIORIDADE[demanda.prioridade] },
      { texto: demanda.status, selo: CLASSE_STATUS[demanda.status] }
    ];
  });

  preencherTabela("tabela-prazo", linhas, "Nenhuma demanda próxima do prazo");
}


// ---------- Início ----------

function iniciarDashboard() {
  const validas = [];
  let invalidas = 0;

  // separa as demandas válidas das inválidas
  for (const demanda of demandas) {
    const erros = validarDemanda(demanda);

    if (erros.length === 0) {
      validas.push(demanda);
    } else {
      invalidas++;
      console.warn("Demanda ignorada (" + demanda.titulo + "): " + erros.join(", "));
    }
  }

  // demandas inválidas não entram nas contagens, mas o usuário é avisado
  if (invalidas > 0) {
    const aviso = document.getElementById("aviso-dados");
    aviso.textContent = invalidas + " demanda(s) com dados inválidos foram ignoradas no resumo.";
    aviso.hidden = false;
  }

  preencherNumeros(validas);
  preencherBarras("card-prioridade", "prioridade", validas);
  preencherBarras("card-tipo", "tipo", validas);
  preencherCriticas(validas);
  preencherProximasDoPrazo(validas);
}

iniciarDashboard();
