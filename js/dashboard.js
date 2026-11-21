/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Tela de dashboard: busca os indicadores em GET /dashboard e preenche a tela.
 * A API devolve só as demandas dos projetos do usuário (o Administrador vê todas).
 * Se a API devolver erro ou estiver fora do ar, a mensagem aparece no aviso vermelho.
 * usuarioLogado() e chamarApi() estão em js/dados.js; criarEtiqueta() e
 * formatarData() estão em js/formato.js.
 */

// Id do número de cada status no HTML
const CARTOES_STATUS = {
  "Aberta": "metrica-aberta",
  "Em andamento": "metrica-andamento",
  "Em revisão": "metrica-revisao",
  "Concluída": "metrica-concluida",
  "Cancelada": "metrica-cancelada"
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

// Cada célula é um texto, um objeto { etiqueta } para a etiqueta colorida
// ou um objeto { texto, link } para o título que leva à demanda
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
      } else if (celula.link) {
        const link = document.createElement("a");
        link.className = "link-demanda";
        link.href = celula.link;
        link.textContent = celula.texto;
        td.appendChild(link);
      } else {
        td.appendChild(criarEtiqueta(celula.etiqueta));
      }

      tr.appendChild(td);
    }

    corpo.appendChild(tr);
  }
}

function preencherCriticas(criticas) {
  const linhas = criticas.map(function (demanda) {
    return [
      { texto: demanda.titulo, link: "demanda.html?id=" + demanda.id },
      demanda.projeto,
      demanda.responsavel || "-",
      { etiqueta: demanda.status }
    ];
  });

  preencherTabela("corpo-criticas", linhas, "Nenhuma demanda crítica em aberto");
}

function preencherProximasDoPrazo(proximas, diasAlerta) {
  const linhas = proximas.map(function (demanda) {
    let textoPrazo = formatarData(demanda.prazo);
    if (demanda.vencida) {
      textoPrazo += " (vencido)";
    }

    return [
      { texto: demanda.titulo, link: "demanda.html?id=" + demanda.id },
      textoPrazo,
      { etiqueta: demanda.prioridade },
      { etiqueta: demanda.status }
    ];
  });

  preencherTabela("corpo-prazo", linhas, "Nenhuma demanda vencida ou com prazo nos próximos " + diasAlerta + " dias");
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

async function carregarDashboard(usuario) {
  limparAviso();

  // API fora do ar ou erro (400, 401, 500...): a mensagem já vem pronta
  const resposta = await chamarApi("GET", "/dashboard?usuarioId=" + encodeURIComponent(usuario.id));
  if (!resposta.ok) {
    mostrarAviso(resposta.erro);
    limparTela();
    return;
  }

  preencherTela(resposta.dados);
}

// sem usuário logado, usuarioLogado() já manda para a tela de login
const usuario = usuarioLogado();
if (usuario) {
  if (usuario.perfil !== PERFIS.ADMIN) {
    document.getElementById("subtitulo-dashboard").textContent = "Resumo das demandas dos seus projetos";
  }
  carregarDashboard(usuario);
}