/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Controle da tela de listagem de demandas (pages/listagem.html).
 *
 * Responsabilidades deste arquivo:
 *   - carregar apenas as demandas que o usuario logado pode enxergar;
 *   - montar os filtros de status, prioridade, tipo, responsavel e projeto;
 *   - aplicar a busca textual por titulo ou descricao;
 *   - ordenar os resultados por prioridade, criacao, prazo ou status;
 *   - desenhar a tabela e dar acesso aos detalhes de cada demanda.
 *
 * Itens 2.2.9 e 2.3 do documento de visao.
 */

/* Valor usado nos filtros para dizer "nao filtrar por este criterio". */
const TODOS = '';

/* Usuario autenticado no momento (na simulacao, o escolhido na barra do topo). */
let usuarioListagem = null;

/* Demandas que o usuario pode ver. Os filtros trabalham sempre sobre esta lista. */
let demandasDoUsuario = [];


/* ==========================================================================
   Inicializacao
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  usuarioListagem = usuarioLogado();
  demandasDoUsuario = demandasVisiveis(usuarioListagem);

  montarFiltros();
  ligarEventos();
  aplicarPermissoes();
  desenharTabela();
});

/* Mostra o botao de nova demanda somente para quem pode criar demandas. */
function aplicarPermissoes() {
  if (podeCriarDemanda(usuarioListagem)) {
    document.getElementById('botao-nova-demanda').classList.remove('oculto');
  }

  // Explica ao usuario o alcance do que ele esta vendo.
  const subtitulo = document.getElementById('subtitulo-listagem');
  if (usuarioListagem.perfil === PERFIS.ADMIN) {
    subtitulo.textContent = 'Lista de todas as demandas cadastradas no sistema';
  } else {
    subtitulo.textContent = 'Demandas dos projetos aos quais voce esta vinculado';
  }
}


/* ==========================================================================
   Filtros
   ========================================================================== */

function montarFiltros() {
  /*
   * A lista de tipos e montada a partir das proprias demandas, e nao da
   * constante TIPOS, porque a demanda aceita tipos personalizados escritos
   * pelo usuario.
   */
  const tiposEmUso = [];
  demandasDoUsuario.forEach(function (demanda) {
    if (tiposEmUso.indexOf(demanda.tipo) < 0) {
      tiposEmUso.push(demanda.tipo);
    }
  });
  TIPOS.forEach(function (tipo) {
    if (tiposEmUso.indexOf(tipo) < 0) {
      tiposEmUso.push(tipo);
    }
  });

  preencherFiltro('filtro-status', 'Todos', Object.values(STATUS));
  preencherFiltro('filtro-prioridade', 'Todas', PRIORIDADES);
  preencherFiltro('filtro-tipo', 'Todos', tiposEmUso.sort());

  // Responsavel: apenas quem realmente aparece como responsavel nas demandas.
  const responsaveis = [];
  demandasDoUsuario.forEach(function (demanda) {
    (demanda.responsaveisIds || []).forEach(function (id) {
      if (responsaveis.indexOf(id) < 0) {
        responsaveis.push(id);
      }
    });
  });
  const opcoesResponsavel = responsaveis.map(function (id) {
    return { valor: String(id), texto: nomeUsuario(id) };
  });
  opcoesResponsavel.push({ valor: 'sem', texto: 'Sem responsavel definido' });
  preencherFiltro('filtro-responsavel', 'Todos', opcoesResponsavel);

  // Projeto: apenas os projetos que o usuario enxerga.
  preencherFiltro('filtro-projeto', 'Todos', projetosDisponiveis(usuarioListagem).map(function (projeto) {
    return { valor: String(projeto.id), texto: projeto.nome };
  }));

  preencherFiltro('filtro-ordem', null, [
    { valor: 'prioridade', texto: 'Prioridade' },
    { valor: 'criacao', texto: 'Data de criacao' },
    { valor: 'prazo', texto: 'Prazo de finalizacao' },
    { valor: 'status', texto: 'Status' }
  ]);
}

/*
 * Preenche um select de filtro.
 * As opcoes podem ser textos simples ou objetos { valor, texto }.
 */
function preencherFiltro(id, rotuloTodos, opcoes) {
  const select = document.getElementById(id);
  select.innerHTML = '';

  if (rotuloTodos) {
    const todos = document.createElement('option');
    todos.value = TODOS;
    todos.textContent = rotuloTodos;
    select.appendChild(todos);
  }

  opcoes.forEach(function (opcao) {
    const item = document.createElement('option');
    if (typeof opcao === 'string') {
      item.value = opcao;
      item.textContent = opcao;
    } else {
      item.value = opcao.valor;
      item.textContent = opcao.texto;
    }
    select.appendChild(item);
  });
}

/* Redesenha a tabela a cada mudanca de filtro, sem precisar clicar em botao. */
function ligarEventos() {
  const filtros = ['filtro-busca', 'filtro-status', 'filtro-prioridade',
                   'filtro-tipo', 'filtro-responsavel', 'filtro-projeto', 'filtro-ordem'];

  filtros.forEach(function (id) {
    const campo = document.getElementById(id);
    campo.addEventListener('input', desenharTabela);
    campo.addEventListener('change', desenharTabela);
  });

  document.getElementById('botao-limpar').addEventListener('click', function () {
    filtros.forEach(function (id) {
      const campo = document.getElementById(id);
      if (id !== 'filtro-ordem') {
        campo.value = TODOS;
      }
    });
    document.getElementById('filtro-ordem').value = 'prioridade';
    desenharTabela();
  });
}

/* Aplica todos os filtros e a busca textual sobre as demandas visiveis. */
function filtrarDemandas() {
  const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
  const status = document.getElementById('filtro-status').value;
  const prioridade = document.getElementById('filtro-prioridade').value;
  const tipo = document.getElementById('filtro-tipo').value;
  const responsavel = document.getElementById('filtro-responsavel').value;
  const projeto = document.getElementById('filtro-projeto').value;

  return demandasDoUsuario.filter(function (demanda) {
    if (status !== TODOS && demanda.status !== status) {
      return false;
    }
    if (prioridade !== TODOS && demanda.prioridade !== prioridade) {
      return false;
    }
    if (tipo !== TODOS && demanda.tipo !== tipo) {
      return false;
    }
    if (projeto !== TODOS && demanda.projetoId !== Number(projeto)) {
      return false;
    }

    if (responsavel !== TODOS) {
      const ids = demanda.responsaveisIds || [];
      if (responsavel === 'sem') {
        if (ids.length > 0) {
          return false;
        }
      } else if (ids.indexOf(Number(responsavel)) < 0) {
        return false;
      }
    }

    // Busca textual por titulo ou descricao.
    if (busca) {
      const texto = (demanda.titulo + ' ' + demanda.descricao).toLowerCase();
      if (texto.indexOf(busca) < 0) {
        return false;
      }
    }

    return true;
  });
}

/*
 * Ordena a lista conforme o criterio escolhido.
 * Prioridade e status seguem a ordem logica do negocio, e nao a ordem alfabetica.
 */
function ordenarDemandas(demandas) {
  const criterio = document.getElementById('filtro-ordem').value;
  const ordemStatus = [STATUS.ABERTA, STATUS.ANDAMENTO, STATUS.REVISAO, STATUS.CONCLUIDA, STATUS.CANCELADA];

  return demandas.slice().sort(function (a, b) {
    if (criterio === 'prioridade') {
      return PRIORIDADES.indexOf(a.prioridade) - PRIORIDADES.indexOf(b.prioridade);
    }
    if (criterio === 'status') {
      return ordemStatus.indexOf(a.status) - ordemStatus.indexOf(b.status);
    }
    if (criterio === 'prazo') {
      // Demandas sem prazo vao para o fim da lista.
      if (!a.prazo) { return 1; }
      if (!b.prazo) { return -1; }
      return a.prazo.localeCompare(b.prazo);
    }
    // Data de criacao: da mais recente para a mais antiga.
    return String(b.dataCriacao).localeCompare(String(a.dataCriacao));
  });
}


/* ==========================================================================
   Desenho da tabela
   ========================================================================== */

function desenharTabela() {
  const corpo = document.getElementById('corpo-tabela');
  const demandas = ordenarDemandas(filtrarDemandas());

  corpo.innerHTML = '';

  atualizarContador(demandas.length);

  if (demandas.length === 0) {
    corpo.appendChild(linhaVazia());
    return;
  }

  demandas.forEach(function (demanda) {
    corpo.appendChild(montarLinha(demanda));
  });
}

/* Informa quantas demandas estao sendo exibidas em relacao ao total visivel. */
function atualizarContador(exibidas) {
  const total = demandasDoUsuario.length;
  const contador = document.getElementById('contador-resultados');

  if (total === 0) {
    contador.textContent = 'Nenhuma demanda disponivel para o seu perfil.';
  } else if (exibidas === total) {
    contador.textContent = 'Exibindo ' + total + (total === 1 ? ' demanda.' : ' demandas.');
  } else {
    contador.textContent = 'Exibindo ' + exibidas + ' de ' + total + ' demandas.';
  }
}

/* Linha unica exibida quando nenhuma demanda atende aos filtros. */
function linhaVazia() {
  const linha = document.createElement('tr');
  linha.className = 'linha-vazia';

  const celula = document.createElement('td');
  celula.colSpan = 9;
  celula.textContent = demandasDoUsuario.length === 0
    ? 'Voce ainda nao tem demandas nos projetos aos quais esta vinculado.'
    : 'Nenhuma demanda encontrada com os filtros aplicados.';

  linha.appendChild(celula);
  return linha;
}

/* Monta uma linha da tabela com os dados principais da demanda. */
function montarLinha(demanda) {
  const linha = document.createElement('tr');
  const projeto = buscarProjeto(demanda.projetoId);

  linha.appendChild(celulaTexto(demanda.titulo));
  linha.appendChild(celulaTexto(demanda.tipo));
  linha.appendChild(celulaEtiqueta(demanda.prioridade));
  linha.appendChild(celulaEtiqueta(demanda.status));
  linha.appendChild(celulaTexto(projeto ? projeto.nome : '-'));

  const celulaResponsaveis = celulaTexto(nomesUsuarios(demanda.responsaveisIds));
  celulaResponsaveis.className = 'coluna-responsaveis';
  linha.appendChild(celulaResponsaveis);

  linha.appendChild(celulaTexto(formatarData(demanda.dataCriacao)));
  linha.appendChild(celulaTexto(demanda.prazo ? formatarData(demanda.prazo) : '-'));

  // O link leva para a tela de edicao, que aplica as permissoes do perfil.
  const acoes = document.createElement('td');
  const link = document.createElement('a');
  link.className = 'link-detalhes';
  link.href = 'demanda.html?id=' + demanda.id;
  link.textContent = 'Ver detalhes';
  acoes.appendChild(link);
  linha.appendChild(acoes);

  return linha;
}

function celulaTexto(texto) {
  const celula = document.createElement('td');
  // textContent evita que o conteudo cadastrado seja interpretado como HTML.
  celula.textContent = texto;
  return celula;
}

function celulaEtiqueta(valor) {
  const celula = document.createElement('td');
  celula.appendChild(criarEtiqueta(valor));
  return celula;
}
