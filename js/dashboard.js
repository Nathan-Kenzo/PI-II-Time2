/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Tela de dashboard: busca os indicadores em GET /dashboard e preenche a tela.
 * Se a API devolver erro ou estiver fora do ar, a mensagem aparece no aviso vermelho.
 */

const API_URL = "http://localhost:3000";

// Id do número de cada status no HTML
const CARTOES_STATUS = {
  "Aberta": "metrica-aberta",
  "Em andamento": "metrica-andamento",
  "Em revisão": "metrica-revisao",
  "Concluída": "metrica-concluida",
  "Cancelada": "metrica-cancelada"
};

// Classes do CSS (selos coloridos)
const SELO_STATUS = {
  "Aberta": "selo-aberta",
  "Em andamento": "selo-andamento",
  "Em revisão": "selo-revisao",
  "Concluída": "selo-concluida",
  "Cancelada": "selo-cancelada"
};

const SELO_PRIORIDADE = {
  "Crítica": "selo-critica",
  "Alta": "selo-alta",
  "Média": "selo-media",
  "Baixa": "selo-baixa"
};

// Cor das barras de prioridade (as de tipo usam a cor padrão)
const COR_PRIORIDADE = {
  "Crítica": "var(--prioridade-critica)",
  "Alta": "var(--prioridade-alta)",
  "Média": "var(--prioridade-media)",
  "Baixa": "var(--prioridade-baixa)"
};

const COR_PADRAO = "var(--cor-primaria)";


// ---------- Aviso de erro ----------

function mostrarAviso(mensagem) {
  const aviso = document.getElementById("aviso-dados");
  aviso.textContent = mensagem;
  aviso.hidden = false;
}

function limparAviso() {
  const aviso = document.getElementById("aviso-dados");
  aviso.textContent = "";
  aviso.hidden = true;
}

// A API devolve erros no formato { erro: "...", detalhes: ["..."] }
function montarMensagemErro(dados, codigo) {
  let mensagem = "Erro ao carregar o dashboard";

  if (dados && dados.erro) {
    mensagem = dados.erro;
  }

  if (dados && Array.isArray(dados.detalhes) && dados.detalhes.length > 0) {
    mensagem += ": " + dados.detalhes.join(" ");
  }

  return mensagem + " (código " + codigo + ")";
}


// ---------- Preenchimento da tela ----------

function preencherNumeros(dados) {
  document.getElementById("metrica-total").textContent = dados.total;

  for (const status of Object.keys(CARTOES_STATUS)) {
    const quantidade = dados.porStatus[status] || 0;
    document.getElementById(CARTOES_STATUS[status]).textContent = quantidade;
  }
}

// Cria uma barra para cada item da contagem, ex: { "Alta": 3, "Baixa": 2 }
function preencherBarras(idContainer, contagem, cores, total) {
  const container = document.getElementById(idContainer);
  container.innerHTML = "";

  for (const rotulo of Object.keys(contagem)) {
    const quantidade = contagem[rotulo];

    let porcentagem = 0;
    if (total > 0) {
      porcentagem = (quantidade / total) * 100;
    }

    const item = document.createElement("div");
    item.className = "barra-item";

    const textoRotulo = document.createElement("span");
    textoRotulo.className = "barra-rotulo";
    textoRotulo.textContent = rotulo;

    const fundo = document.createElement("div");
    fundo.className = "barra-fundo";

    const preenchida = document.createElement("div");
    preenchida.className = "barra-preenchida";
    preenchida.style.width = porcentagem + "%";
    preenchida.style.backgroundColor = cores[rotulo] || COR_PADRAO;
    fundo.appendChild(preenchida);

    const valor = document.createElement("span");
    valor.className = "barra-valor";
    valor.textContent = quantidade;

    item.appendChild(textoRotulo);
    item.appendChild(fundo);
    item.appendChild(valor);
    container.appendChild(item);
  }
}

// Cada célula é um texto ou um objeto { texto, selo } quando precisa do selo colorido
function preencherTabela(idCorpo, linhas, mensagemVazia) {
  const corpo = document.getElementById(idCorpo);
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

function preencherCriticas(criticas) {
  const linhas = criticas.map(function (demanda) {
    return [
      demanda.titulo,
      demanda.projeto,
      demanda.responsavel || "-",
      { texto: demanda.status, selo: SELO_STATUS[demanda.status] }
    ];
  });

  preencherTabela("corpo-criticas", linhas, "Nenhuma demanda crítica em aberto");
}

function preencherProximasDoPrazo(proximas, diasAlerta) {
  const linhas = proximas.map(function (demanda) {
    // formatarData está em js/formato.js
    let textoPrazo = formatarData(demanda.prazo);
    if (demanda.vencida) {
      textoPrazo += " (vencido)";
    }

    return [
      demanda.titulo,
      textoPrazo,
      { texto: demanda.prioridade, selo: SELO_PRIORIDADE[demanda.prioridade] },
      { texto: demanda.status, selo: SELO_STATUS[demanda.status] }
    ];
  });

  preencherTabela("corpo-prazo", linhas, "Nenhuma demanda com prazo nos próximos " + diasAlerta + " dias");
}

function preencherTela(dados) {
  preencherNumeros(dados);
  preencherBarras("barras-prioridade", dados.porPrioridade, COR_PRIORIDADE, dados.total);
  preencherBarras("barras-tipo", dados.porTipo, {}, dados.total);
  preencherCriticas(dados.criticasEmAberto);
  preencherProximasDoPrazo(dados.proximasDoPrazo, dados.diasAlerta);
}

// Usada quando a API falha, para não deixar números antigos na tela
function limparTela() {
  document.getElementById("metrica-total").textContent = "-";

  for (const status of Object.keys(CARTOES_STATUS)) {
    document.getElementById(CARTOES_STATUS[status]).textContent = "-";
  }

  document.getElementById("barras-prioridade").innerHTML = "";
  document.getElementById("barras-tipo").innerHTML = "";
  preencherTabela("corpo-criticas", [], "Sem dados");
  preencherTabela("corpo-prazo", [], "Sem dados");
}


// ---------- Chamada à API ----------

async function carregarDashboard() {
  limparAviso();

  // falha aqui = API fora do ar
  let resposta;
  try {
    resposta = await fetch(API_URL + "/dashboard");
  } catch (erro) {
    console.error("Falha ao chamar a API:", erro);
    mostrarAviso("Não foi possível conectar à API. Confira se o backend está rodando em " + API_URL + ".");
    limparTela();
    return;
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (erro) {
    dados = null;
  }

  // a API respondeu com erro (400, 401, 404, 500...)
  if (!resposta.ok) {
    mostrarAviso(montarMensagemErro(dados, resposta.status));
    limparTela();
    return;
  }

  if (dados === null) {
    mostrarAviso("A API devolveu uma resposta inesperada.");
    limparTela();
    return;
  }

  preencherTela(dados);
}

carregarDashboard();