/**
 * Autor: Nathan Kenzo Puzipe
 * Descricao: Controle da tela de listagem de demandas (pages/listagem.html).
 *
 */

(function () {
  'use strict';

  /* ===================================================================
   * 1. CONFIGURACAO
   * =================================================================== */

  /* Endereco da API do DemandaTrack (backend/, iniciado com "npm run dev"). */
  const API_URL = 'http://localhost:3000';

  /* Tempo de espera depois da ultima tecla da busca, para nao chamar a API a cada letra. */
  const ATRASO_BUSCA_MS = 300;

  /* Ordenacao padrao: demandas mais recentes primeiro. */
  const ORDEM_PADRAO = 'dataCriacao:desc';

  /* Valor do filtro de responsavel que significa "demandas sem responsavel". */
  const SEM_RESPONSAVEL = 'sem';

  /* IDs dos elementos de pages/listagem.html. */
  const IDS = {
    busca: 'filtro-busca',
    status: 'filtro-status',
    prioridade: 'filtro-prioridade',
    tipo: 'filtro-tipo',
    responsavel: 'filtro-responsavel',
    projeto: 'filtro-projeto',
    ordem: 'filtro-ordem'
  };

  /* Valores aceitos pela API (os mesmos de backend/src/tipos.ts). */
  const OPCOES = {
    status: ['Aberta', 'Em andamento', 'Em revisão', 'Concluída', 'Cancelada'],
    prioridade: ['Crítica', 'Alta', 'Média', 'Baixa'],
    tipo: ['Tarefa', 'Defeito', 'Melhoria', 'Documentação']
  };

  /* Opcoes de ordenacao: o valor e "campo:ordem", como a API espera. */
  const OPCOES_ORDEM = [
    { valor: 'dataCriacao:desc', rotulo: 'Mais recentes' },
    { valor: 'dataCriacao:asc', rotulo: 'Mais antigas' },
    { valor: 'prioridade:asc', rotulo: 'Prioridade (maior primeiro)' },
    { valor: 'prioridade:desc', rotulo: 'Prioridade (menor primeiro)' },
    { valor: 'prazo:asc', rotulo: 'Prazo (mais próximo)' },
    { valor: 'prazo:desc', rotulo: 'Prazo (mais distante)' },
    { valor: 'status:asc', rotulo: 'Status (Aberta primeiro)' },
    { valor: 'status:desc', rotulo: 'Status (Concluída primeiro)' }
  ];


  /* ===================================================================
   * 2. ESTADO DA TELA
   * =================================================================== */

  const campos = {};              // elementos dos filtros, por chave
  let usuario = null;             // usuario logado
  let requisicaoAtual = 0;        // numero da ultima chamada, para ignorar respostas antigas
  let temporizadorBusca = null;   // espera da busca (debounce)
  let ultimaConsulta = null;      // query string da ultima chamada, para nao repetir a mesma
  let totalGeral = null;          // quantas demandas o usuario enxerga sem filtro
  let idsProjetos = null;         // ids validos do filtro de projeto (null = ainda nao carregou)
  let idsResponsaveis = null;     // ids validos do filtro de responsavel (null = ainda nao carregou)


  /* ===================================================================
   * 3. FUNCOES AUXILIARES
   * =================================================================== */

  /* Remove os acentos de um texto (usado para achar a cor da etiqueta). */
  function semAcento(texto) {
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /*
   * Etiqueta colorida de status ou prioridade.
   * A API devolve os valores com acento ("Crítica"); o mapa de cores de
   * js/formato.js usa os valores sem acento, por isso a conversao.
   */
  function criarEtiquetaDaApi(valor) {
    const etiqueta = criarEtiqueta(valor);
    etiqueta.className = 'etiqueta ' + classeDaEtiqueta(semAcento(valor));
    return etiqueta;
  }

  /* Preenche um select com a opcao "Todos" e as opcoes informadas ({ valor, rotulo }). */
  function montarSelect(select, rotuloTodos, opcoes) {
    select.innerHTML = '';

    const todos = document.createElement('option');
    todos.value = '';
    todos.textContent = rotuloTodos;
    select.appendChild(todos);

    opcoes.forEach(function (opcao) {
      const item = document.createElement('option');
      item.value = opcao.valor;
      item.textContent = opcao.rotulo;
      select.appendChild(item);
    });
  }

  /* Transforma uma lista de textos em opcoes cujo valor e o proprio texto. */
  function opcoesDeTextos(textos) {
    return textos.map(function (texto) {
      return { valor: texto, rotulo: texto };
    });
  }

  /* Valores atuais de todos os filtros, sem tratamento. */
  function lerFiltros() {
    const filtros = {};
    Object.keys(IDS).forEach(function (chave) {
      filtros[chave] = campos[chave] ? campos[chave].value : '';
    });
    return filtros;
  }

  /* Algum filtro de texto ou de lista esta preenchido? (a ordenacao nao conta) */
  function haFiltroAtivo(filtros) {
    return ['busca', 'status', 'prioridade', 'tipo', 'responsavel', 'projeto'].some(function (chave) {
      return filtros[chave] !== '';
    });
  }


  /* ===================================================================
   * 4. VALIDACAO DOS FILTROS (Reuniao 3)
   * =================================================================== */

  /* Devolve um objeto { chave: mensagem } so com os filtros invalidos. */
  function validarFiltros(filtros) {
    const erros = {};

    const erroBusca = validarBusca(filtros.busca);
    if (erroBusca) erros.busca = erroBusca;

    const regras = [
      ['status', OPCOES.status, 'Selecione um status válido.'],
      ['prioridade', OPCOES.prioridade, 'Selecione uma prioridade válida.'],
      ['tipo', OPCOES.tipo, 'Selecione um tipo válido.']
    ];
    regras.forEach(function (regra) {
      const erro = validarOpcao(filtros[regra[0]], regra[1], regra[2]);
      if (erro) erros[regra[0]] = erro;
    });

    // Projeto e responsavel so sao conferidos depois que a lista foi carregada.
    if (idsProjetos !== null) {
      const erro = validarOpcao(filtros.projeto, idsProjetos, 'Selecione um projeto válido.');
      if (erro) erros.projeto = erro;
    }
    if (idsResponsaveis !== null) {
      const erro = validarOpcao(filtros.responsavel, idsResponsaveis.concat([SEM_RESPONSAVEL]), 'Selecione um responsável válido.');
      if (erro) erros.responsavel = erro;
    }

    const ordemValida = OPCOES_ORDEM.some(function (opcao) { return opcao.valor === filtros.ordem; });
    if (!ordemValida) erros.ordem = 'Selecione uma ordenação válida.';

    return erros;
  }

  /* Encontra (ou cria) o elemento que mostra o erro de um campo, logo abaixo dele. */
  function elementoDeErro(campo) {
    let el = document.querySelector('[data-erro-para="' + campo.id + '"]');
    if (!el) {
      el = document.createElement('span');
      el.className = 'mensagem-erro';
      el.id = 'erro-' + campo.id;
      el.setAttribute('data-erro-para', campo.id);
      el.hidden = true;
      campo.insertAdjacentElement('afterend', el);
      campo.setAttribute('aria-describedby', el.id);
    }
    return el;
  }

  /* Mostra (ou apaga, se a mensagem for vazia) o erro de um filtro. */
  function mostrarErro(chave, mensagem) {
    const campo = campos[chave];
    if (!campo) return;

    const el = elementoDeErro(campo);
    if (mensagem) {
      campo.setAttribute('aria-invalid', 'true');
      campo.classList.add('invalido');
      el.textContent = mensagem;
      el.hidden = false;
    } else {
      campo.removeAttribute('aria-invalid');
      campo.classList.remove('invalido');
      el.textContent = '';
      el.hidden = true;
    }
  }


  /* ===================================================================
   * 5. CHAMADA A API
   * =================================================================== */

  /* Monta a query string de GET /demandas a partir dos filtros ja validados. */
  function montarParametros(filtros) {
    const parametros = new URLSearchParams();
    parametros.set('usuarioId', usuario.id);

    ['status', 'prioridade', 'tipo', 'projeto', 'responsavel'].forEach(function (chave) {
      if (filtros[chave] !== '') parametros.set(chave, filtros[chave]);
    });
    if (filtros.busca.trim() !== '') parametros.set('busca', filtros.busca.trim());

    const partes = filtros.ordem.split(':');
    parametros.set('ordenarPor', partes[0]);
    parametros.set('ordem', partes[1]);

    return parametros;
  }

  /*
   * Chama a API e devolve sempre o mesmo formato, para a tela nao repetir o
   * tratamento de erro:
   *   { ok: true,  dados: <JSON da resposta> }
   *   { ok: false, mensagem: <texto pronto para mostrar ao usuario> }
   * Quando a API recusa o pedido ela responde { erro, detalhes }; os dois sao
   * juntados na mensagem. Se o servidor estiver desligado, o fetch falha.
   */
  async function chamarApi(caminho) {
    try {
      const resposta = await fetch(API_URL + caminho);
      let dados = {};
      try {
        dados = await resposta.json();
      } catch (erroDeLeitura) {
        dados = {};
      }

      if (!resposta.ok) {
        const detalhes = Array.isArray(dados.detalhes) ? ' ' + dados.detalhes.join(' ') : '';
        return { ok: false, mensagem: (dados.erro || 'Erro ' + resposta.status) + '.' + detalhes };
      }
      return { ok: true, dados: dados };
    } catch (erro) {
      console.warn('Falha ao chamar a API:', erro);
      return { ok: false, mensagem: 'A API não respondeu. Confira se o servidor está rodando em ' + API_URL + '.' };
    }
  }


  /* ===================================================================
   * 6. EXIBICAO DO RESULTADO
   * =================================================================== */

  /* Faixa de erro acima da tabela. Texto vazio esconde a faixa. */
  function mostrarAviso(texto) {
    let aviso = document.getElementById('aviso-erro');
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.id = 'aviso-erro';
      aviso.className = 'resumo-erros';
      aviso.setAttribute('role', 'alert');
      const caixa = document.querySelector('.caixa-tabela');
      caixa.parentNode.insertBefore(aviso, caixa);
    }
    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }

  /* Cria uma celula de tabela com texto simples (textContent: nada vira HTML). */
  function criarCelula(texto) {
    const td = document.createElement('td');
    td.textContent = texto;
    return td;
  }

  /* Cria a linha da tabela de uma demanda. */
  function criarLinha(demanda) {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(demanda.titulo));
    tr.appendChild(criarCelula(demanda.tipo));

    const tdPrioridade = document.createElement('td');
    tdPrioridade.appendChild(criarEtiquetaDaApi(demanda.prioridade));
    tr.appendChild(tdPrioridade);

    const tdStatus = document.createElement('td');
    tdStatus.appendChild(criarEtiquetaDaApi(demanda.status));
    tr.appendChild(tdStatus);

    tr.appendChild(criarCelula(demanda.projeto));

    const tdResponsavel = criarCelula(demanda.responsavel || '-');
    tdResponsavel.className = 'coluna-responsaveis';
    tr.appendChild(tdResponsavel);

    tr.appendChild(criarCelula(formatarData(demanda.dataCriacao)));
    tr.appendChild(criarCelula(formatarData(demanda.prazo)));

    const tdDetalhes = document.createElement('td');
    const link = document.createElement('a');
    link.className = 'link-detalhes';
    link.href = 'demanda.html?id=' + encodeURIComponent(demanda.id);
    link.textContent = 'Ver detalhes';
    tdDetalhes.appendChild(link);
    tr.appendChild(tdDetalhes);

    return tr;
  }

  /* Desenha a tabela. Sem resultados, mostra uma linha avisando. */
  function mostrarTabela(demandas) {
    const corpo = document.getElementById('corpo-tabela');
    corpo.innerHTML = '';

    if (demandas.length === 0) {
      const tr = document.createElement('tr');
      tr.className = 'linha-vazia';
      const td = criarCelula('Nenhuma demanda encontrada com esses filtros.');
      td.colSpan = 9;
      tr.appendChild(td);
      corpo.appendChild(tr);
      return;
    }

    demandas.forEach(function (demanda) {
      corpo.appendChild(criarLinha(demanda));
    });
  }

  /* Texto "Exibindo X de Y demandas." acima da tabela. */
  function mostrarContador(exibidas) {
    const contador = document.getElementById('contador-resultados');
    if (!contador) return;

    if (totalGeral === null) {
      contador.textContent = exibidas + (exibidas === 1 ? ' demanda encontrada.' : ' demandas encontradas.');
      return;
    }
    contador.textContent = 'Exibindo ' + exibidas + ' de ' + totalGeral +
      (totalGeral === 1 ? ' demanda.' : ' demandas.');
  }

  /*
   * Monta os selects de projeto e de responsavel com o que veio na primeira
   * carga (sem filtros). Assim aparecem so os projetos e as pessoas das
   * demandas que este usuario pode ver.
   */
  function montarOpcoesDaLista(demandas) {
    const projetos = {};
    const responsaveis = {};
    let haSemResponsavel = false;

    demandas.forEach(function (demanda) {
      projetos[demanda.projetoId] = demanda.projeto;
      if (demanda.responsavelId === null) {
        haSemResponsavel = true;
      } else {
        responsaveis[demanda.responsavelId] = demanda.responsavel;
      }
    });

    function ordenadoPorNome(mapa) {
      return Object.keys(mapa)
        .map(function (id) { return { valor: id, rotulo: mapa[id] }; })
        .sort(function (a, b) { return a.rotulo.localeCompare(b.rotulo, 'pt-BR'); });
    }

    const opcoesProjeto = ordenadoPorNome(projetos);
    const opcoesResponsavel = ordenadoPorNome(responsaveis);
    if (haSemResponsavel) {
      opcoesResponsavel.push({ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' });
    }

    montarSelect(campos.projeto, 'Todos', opcoesProjeto);
    montarSelect(campos.responsavel, 'Todos', opcoesResponsavel);

    idsProjetos = opcoesProjeto.map(function (o) { return o.valor; });
    idsResponsaveis = opcoesResponsavel.map(function (o) { return o.valor; })
      .filter(function (valor) { return valor !== SEM_RESPONSAVEL; });
  }


  /* ===================================================================
   * 7. CARGA DA LISTA
   * =================================================================== */

  /*
   * Valida os filtros e, se estiverem corretos, busca a lista na API.
   * "digitando" e true quando a chamada vem da busca por teclas: nesse caso um
   * erro novo da busca ainda nao e mostrado (so ao sair do campo), para nao
   * acusar erro enquanto a pessoa esta no meio da palavra.
   */
  async function carregar(digitando) {
    const filtros = lerFiltros();
    const erros = validarFiltros(filtros);

    Object.keys(IDS).forEach(function (chave) {
      const jaMostrandoErro = campos[chave] && campos[chave].classList.contains('invalido');
      const esconderPorEnquanto = digitando && chave === 'busca' && !jaMostrandoErro;
      mostrarErro(chave, esconderPorEnquanto ? '' : (erros[chave] || ''));
    });

    // Filtro invalido: nada e enviado e a tabela continua como estava.
    if (Object.keys(erros).length > 0) {
      return;
    }

    // Mesmo pedido da ultima vez (ex.: Enter e depois sair do campo): nao repete.
    const consulta = montarParametros(filtros).toString();
    if (consulta === ultimaConsulta) {
      return;
    }
    ultimaConsulta = consulta;

    const numero = ++requisicaoAtual;
    const resposta = await chamarApi('/demandas?' + consulta);

    // Se o usuario mudou um filtro enquanto esta resposta vinha, ela ja e antiga.
    if (numero !== requisicaoAtual) {
      return;
    }

    if (!resposta.ok) {
      ultimaConsulta = null; // permite tentar de novo o mesmo pedido
      mostrarAviso(resposta.mensagem);
      return;
    }
    mostrarAviso('');

    const demandas = resposta.dados.demandas;

    // Sem filtros, a lista e "tudo que o usuario enxerga": serve de base para
    // o total e para os selects de projeto e de responsavel.
    if (!haFiltroAtivo(filtros)) {
      totalGeral = demandas.length;
      if (idsProjetos === null) {
        montarOpcoesDaLista(demandas);
      }
    }

    mostrarTabela(demandas);
    mostrarContador(demandas.length);
  }


  /* ===================================================================
   * 8. INICIALIZACAO
   * =================================================================== */

  /* Volta todos os filtros ao estado inicial e recarrega a lista. */
  function limparFiltros() {
    campos.busca.value = '';
    ['status', 'prioridade', 'tipo', 'responsavel', 'projeto'].forEach(function (chave) {
      campos[chave].value = '';
    });
    campos.ordem.value = ORDEM_PADRAO;

    clearTimeout(temporizadorBusca);
    carregar(false);
    campos.busca.focus();
  }

  function iniciar() {
    Object.keys(IDS).forEach(function (chave) {
      campos[chave] = document.getElementById(IDS[chave]);
    });
    // Sem os campos esperados a tela nao tem o que controlar.
    if (Object.keys(campos).some(function (chave) { return !campos[chave]; })) {
      console.error('listagem.js: algum campo de filtro nao foi encontrado em listagem.html.');
      return;
    }

    usuario = usuarioLogado();

    // O botao "Nova demanda" so aparece para quem pode criar demandas.
    const botaoNova = document.getElementById('botao-nova-demanda');
    if (botaoNova && podeCriarDemanda(usuario)) {
      botaoNova.classList.remove('oculto');
    }

    // O Administrador ve tudo; os demais, so os projetos a que estao vinculados.
    const subtitulo = document.getElementById('subtitulo-listagem');
    if (subtitulo && usuario.perfil !== PERFIS.ADMIN) {
      subtitulo.textContent = 'Demandas dos projetos aos quais você está vinculado';
    }

    montarSelect(campos.status, 'Todos', opcoesDeTextos(OPCOES.status));
    montarSelect(campos.prioridade, 'Todas', opcoesDeTextos(OPCOES.prioridade));
    montarSelect(campos.tipo, 'Todos', opcoesDeTextos(OPCOES.tipo));
    montarSelect(campos.responsavel, 'Todos', []);
    montarSelect(campos.projeto, 'Todos', []);
    campos.ordem.innerHTML = '';
    OPCOES_ORDEM.forEach(function (opcao) {
      const item = document.createElement('option');
      item.value = opcao.valor;
      item.textContent = opcao.rotulo;
      campos.ordem.appendChild(item);
    });
    campos.ordem.value = ORDEM_PADRAO;

    // Selects: filtra assim que a pessoa escolhe.
    ['status', 'prioridade', 'tipo', 'responsavel', 'projeto', 'ordem'].forEach(function (chave) {
      campos[chave].addEventListener('change', function () { carregar(false); });
    });

    // Busca: espera a pessoa parar de digitar; ao sair do campo valida na hora.
    campos.busca.addEventListener('input', function () {
      clearTimeout(temporizadorBusca);
      temporizadorBusca = setTimeout(function () { carregar(true); }, ATRASO_BUSCA_MS);
    });
    campos.busca.addEventListener('blur', function () {
      clearTimeout(temporizadorBusca);
      carregar(false);
    });
    campos.busca.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') {
        clearTimeout(temporizadorBusca);
        carregar(false);
      }
    });

    document.getElementById('botao-limpar').addEventListener('click', limparFiltros);

    carregar(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();