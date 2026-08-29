/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Calculo dos indicadores da tela inicial (pages/dashboard.html).
 *
 * Todos os numeros sao apurados a partir das demandas que o usuario logado pode
 * enxergar, de modo que o Administrador ve o total do sistema e os demais perfis
 * veem apenas os projetos aos quais estao vinculados.
 *
 * Indicadores obrigatorios do item 2.4 do documento de visao.
 */

/* Quantos dias antes do prazo a demanda ja entra em "proxima do prazo". */
const DIAS_PROXIMO_DO_PRAZO = 15;


document.addEventListener('DOMContentLoaded', function () {
  const usuario = usuarioLogado();
  const demandas = demandasVisiveis(usuario);

  atualizarSubtitulo(usuario);
  contarPorStatus(demandas);
  desenharBarrasDePrioridade(demandas);
  desenharBarrasDeTipo(demandas);
  listarCriticasEmAberto(demandas);
  listarProximasDoPrazo(demandas);
});

/* Deixa claro se os numeros sao do sistema inteiro ou apenas dos projetos do usuario. */
function atualizarSubtitulo(usuario) {
  const subtitulo = document.querySelector('.subtitulo-pagina');
  if (!subtitulo) {
    return;
  }
  subtitulo.textContent = usuario.perfil === PERFIS.ADMIN
    ? 'Resumo geral das demandas cadastradas no sistema'
    : 'Resumo das demandas dos projetos aos quais voce esta vinculado';
}


/* ==========================================================================
   Total de demandas e contagem por status
   ========================================================================== */

function contarPorStatus(demandas) {
  escrever('metrica-total', demandas.length);
  escrever('metrica-aberta', contar(demandas, 'status', STATUS.ABERTA));
  escrever('metrica-andamento', contar(demandas, 'status', STATUS.ANDAMENTO));
  escrever('metrica-revisao', contar(demandas, 'status', STATUS.REVISAO));
  escrever('metrica-concluida', contar(demandas, 'status', STATUS.CONCLUIDA));
  escrever('metrica-cancelada', contar(demandas, 'status', STATUS.CANCELADA));
}

/* Quantas demandas possuem determinado valor em um campo. */
function contar(demandas, campo, valor) {
  return demandas.filter(function (demanda) { return demanda[campo] === valor; }).length;
}

function escrever(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.textContent = valor;
  }
}


/* ==========================================================================
   Barras de prioridade e de tipo
   ========================================================================== */

function desenharBarrasDePrioridade(demandas) {
  const cores = {
    'Critica': 'var(--prioridade-critica)',
    'Alta': 'var(--prioridade-alta)',
    'Media': 'var(--prioridade-media)',
    'Baixa': 'var(--prioridade-baixa)'
  };

  const itens = PRIORIDADES.map(function (prioridade) {
    return {
      rotulo: prioridade,
      valor: contar(demandas, 'prioridade', prioridade),
      cor: cores[prioridade]
    };
  });

  desenharBarras('barras-prioridade', itens, demandas.length);
}

/*
 * Os quatro tipos obrigatorios aparecem sempre.
 * Tipos personalizados cadastrados pelos usuarios entram depois deles.
 */
function desenharBarrasDeTipo(demandas) {
  const tipos = TIPOS.slice();

  demandas.forEach(function (demanda) {
    if (tipos.indexOf(demanda.tipo) < 0) {
      tipos.push(demanda.tipo);
    }
  });

  const itens = tipos.map(function (tipo) {
    return {
      rotulo: tipo,
      valor: contar(demandas, 'tipo', tipo),
      cor: 'var(--cor-primaria)'
    };
  });

  desenharBarras('barras-tipo', itens, demandas.length);
}

/*
 * Monta as barras dentro do container informado.
 * A largura de cada barra e proporcional ao total de demandas.
 */
function desenharBarras(idContainer, itens, total) {
  const container = document.getElementById(idContainer);
  container.innerHTML = '';

  itens.forEach(function (item) {
    const linha = document.createElement('div');
    linha.className = 'barra-item';

    const rotulo = document.createElement('span');
    rotulo.className = 'barra-rotulo';
    rotulo.textContent = item.rotulo;

    const fundo = document.createElement('div');
    fundo.className = 'barra-fundo';

    const preenchida = document.createElement('div');
    preenchida.className = 'barra-preenchida';
    preenchida.style.width = (total > 0 ? (item.valor / total) * 100 : 0) + '%';
    preenchida.style.backgroundColor = item.cor;
    fundo.appendChild(preenchida);

    const valor = document.createElement('span');
    valor.className = 'barra-valor';
    valor.textContent = item.valor;

    linha.appendChild(rotulo);
    linha.appendChild(fundo);
    linha.appendChild(valor);
    container.appendChild(linha);
  });
}


/* ==========================================================================
   Demandas criticas em aberto
   Criticas que ainda nao foram concluidas nem canceladas.
   ========================================================================== */

function listarCriticasEmAberto(demandas) {
  const criticas = demandas.filter(function (demanda) {
    return demanda.prioridade === 'Critica'
      && demanda.status !== STATUS.CONCLUIDA
      && demanda.status !== STATUS.CANCELADA;
  });

  const corpo = document.getElementById('corpo-criticas');
  corpo.innerHTML = '';

  if (criticas.length === 0) {
    corpo.appendChild(linhaVaziaDashboard(4, 'Nenhuma demanda critica em aberto'));
    return;
  }

  criticas.forEach(function (demanda) {
    const projeto = buscarProjeto(demanda.projetoId);
    const linha = document.createElement('tr');

    linha.appendChild(celulaLink(demanda));
    linha.appendChild(celula(projeto ? projeto.nome : '-'));
    linha.appendChild(celula(nomesUsuarios(demanda.responsaveisIds)));
    linha.appendChild(celulaEtiquetaDashboard(demanda.status));

    corpo.appendChild(linha);
  });
}


/* ==========================================================================
   Demandas proximas do prazo de finalizacao
   Demandas ainda em andamento cujo prazo esta chegando ou ja venceu.
   ========================================================================== */

function listarProximasDoPrazo(demandas) {
  const proximas = demandas.filter(function (demanda) {
    if (!demanda.prazo) {
      return false;
    }
    if (demanda.status === STATUS.CONCLUIDA || demanda.status === STATUS.CANCELADA) {
      return false;
    }
    const dias = diasAte(demanda.prazo);
    return dias !== null && dias <= DIAS_PROXIMO_DO_PRAZO;
  });

  // Do prazo mais apertado para o mais folgado.
  proximas.sort(function (a, b) { return a.prazo.localeCompare(b.prazo); });

  const corpo = document.getElementById('corpo-prazo');
  corpo.innerHTML = '';

  if (proximas.length === 0) {
    corpo.appendChild(linhaVaziaDashboard(4, 'Nenhuma demanda proxima do prazo'));
    return;
  }

  proximas.forEach(function (demanda) {
    const linha = document.createElement('tr');
    const dias = diasAte(demanda.prazo);

    linha.appendChild(celulaLink(demanda));

    // Alem da data, mostra em quantos dias o prazo vence ou ha quantos venceu.
    const prazo = celula(formatarData(demanda.prazo) + ' (' + descreverPrazo(dias) + ')');
    if (dias < 0) {
      prazo.style.color = 'var(--status-cancelada)';
    }
    linha.appendChild(prazo);

    linha.appendChild(celulaEtiquetaDashboard(demanda.prioridade));
    linha.appendChild(celulaEtiquetaDashboard(demanda.status));

    corpo.appendChild(linha);
  });
}

/* Texto curto indicando a situacao do prazo. */
function descreverPrazo(dias) {
  if (dias < 0) {
    return 'venceu ha ' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' dia' : ' dias');
  }
  if (dias === 0) {
    return 'vence hoje';
  }
  return 'faltam ' + dias + (dias === 1 ? ' dia' : ' dias');
}


/* ==========================================================================
   Funcoes auxiliares das tabelas
   ========================================================================== */

function celula(texto) {
  const td = document.createElement('td');
  // textContent evita que o conteudo cadastrado seja interpretado como HTML.
  td.textContent = texto;
  return td;
}

/* Titulo da demanda como link para a tela de detalhes/edicao. */
function celulaLink(demanda) {
  const td = document.createElement('td');
  const link = document.createElement('a');
  link.href = 'demanda.html?id=' + demanda.id;
  link.textContent = demanda.titulo;
  link.style.color = 'var(--cor-primaria)';
  link.style.textDecoration = 'none';
  td.appendChild(link);
  return td;
}

function celulaEtiquetaDashboard(valor) {
  const td = document.createElement('td');
  td.appendChild(criarEtiqueta(valor));
  return td;
}

function linhaVaziaDashboard(colunas, mensagem) {
  const linha = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colunas;
  td.className = 'tabela-vazia';
  td.textContent = mensagem;
  linha.appendChild(td);
  return linha;
}
