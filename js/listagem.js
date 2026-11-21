/**
 * Autor: Nathan Kenzo Puzipe
 * Descrição: Controle da tela de listagem de demandas (pages/listagem.html).
 *
 * usuarioLogado() e chamarApi() estão em js/dados.js; criarEtiqueta() e
 * formatarData() em js/formato.js; validarBusca() e validarOpcao() em js/validacoes.js.
 */

(function () {
  'use strict';

  /* ===================================================================
   * 1. CONFIGURAÇÃO
   * =================================================================== */

  /* Tempo de espera depois da última tecla da busca, para não chamar a API a cada letra. */
  const ATRASO_BUSCA_MS = 300;

  /* Ordenação padrão: demandas mais recentes primeiro. */
  const ORDEM_PADRAO = 'dataCriacao:desc';

  /* Valor do filtro de responsável que significa "demandas sem responsável". */
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

  /* Valores aceitos pela API (as mesmas listas de js/dados.js, com acento). */
  const OPCOES = {
    status: Object.values(STATUS),
    prioridade: PRIORIDADES,
    tipo: TIPOS
  };

  /*
   * Opções de ordenação: o valor é "campo:ordem", como a API espera.
   * O status segue a ordem do fluxo (Aberta ... Concluída, Cancelada).
   */
  const OPCOES_ORDEM = [
    { valor: 'dataCriacao:desc', rotulo: 'Mais recentes' },
    { valor: 'dataCriacao:asc', rotulo: 'Mais antigas' },
    { valor: 'prioridade:asc', rotulo: 'Prioridade (maior primeiro)' },
    { valor: 'prioridade:desc', rotulo: 'Prioridade (menor primeiro)' },
    { valor: 'prazo:asc', rotulo: 'Prazo (mais próximo)' },
    { valor: 'prazo:desc', rotulo: 'Prazo (mais distante)' },
    { valor: 'status:asc', rotulo: 'Status (Aberta primeiro)' },
    { valor: 'status:desc', rotulo: 'Status (Cancelada primeiro)' }
  ];


  /* ===================================================================
   * 2. ESTADO DA TELA
   * =================================================================== */

  const campos = {};              // elementos dos filtros, por chave
  let usuario = null;             // usuário logado
  let requisicaoAtual = 0;        // número da última chamada, para ignorar respostas antigas
  let temporizadorBusca = null;   // espera da busca (debounce)
  let ultimaConsulta = null;      // query string da última chamada, para não repetir a mesma
  let totalGeral = null;          // quantas demandas o usuário enxerga sem filtro
  let idsProjetos = null;         // ids válidos do filtro de projeto (null = não carregou)
  let idsResponsaveis = null;     // ids válidos do filtro de responsável (null = não carregou)


  /* ===================================================================
   * 3. FUNÇÕES AUXILIARES
   * =================================================================== */

  /* Preenche um select com a opção "Todos" e as opções informadas ({ valor, rotulo }). */
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

  /* Transforma uma lista de textos em opções cujo valor é o próprio texto. */
  function opcoesDeTextos(textos) {
    return textos.map(function (texto) {
      return { valor: texto, rotulo: texto };
    });
  }

  /* Valores atuais de todos os filtros, sem tratamento. */
  function lerFiltros() {
    const filtros = {};
    Object.keys(IDS).forEach(function (chave) {
      filtros[chave] = campos[chave].value;
    });
    return filtros;
  }

  /* Algum filtro de texto ou de lista está preenchido? (a ordenação não conta) */
  function haFiltroAtivo(filtros) {
    return ['busca', 'status', 'prioridade', 'tipo', 'responsavel', 'projeto'].some(function (chave) {
      return filtros[chave] !== '';
    });
  }


  /* ===================================================================
   * 4. VALIDAÇÃO DOS FILTROS
   * =================================================================== */

  /* Devolve um objeto { chave: mensagem } só com os filtros inválidos. */
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

    // Projeto e responsável só são conferidos se a lista veio da API.
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
   * 5. CHAMADA À API
   * =================================================================== */

  /* Monta a query string de GET /demandas a partir dos filtros já validados. */
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
   * Preenche os selects de projeto e de responsável com o que vem do banco:
   * GET /projetos?usuarioId= (só os projetos que o usuário enxerga) e
   * GET /usuarios. Se a API falhar, o select fica só com "Todos".
   */
  async function carregarOpcoesDaApi() {
    const respostas = await Promise.all([
      chamarApi('GET', '/projetos?usuarioId=' + encodeURIComponent(usuario.id)),
      chamarApi('GET', '/usuarios')
    ]);

    if (respostas[0].ok) {
      const opcoesProjeto = respostas[0].dados.projetos.map(function (projeto) {
        return { valor: String(projeto.id), rotulo: projeto.nome };
      });
      montarSelect(campos.projeto, 'Todos', opcoesProjeto);
      idsProjetos = opcoesProjeto.map(function (o) { return o.valor; });
    }

    if (respostas[1].ok) {
      const opcoesResponsavel = respostas[1].dados.usuarios.map(function (pessoa) {
        return { valor: String(pessoa.id), rotulo: pessoa.nome };
      });
      idsResponsaveis = opcoesResponsavel.map(function (o) { return o.valor; });
      opcoesResponsavel.push({ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' });
      montarSelect(campos.responsavel, 'Todos', opcoesResponsavel);
    }

    // Um erro aqui (API fora do ar, usuário inválido) também aparece na carga da
    // lista logo em seguida, então só fica registrado no console.
    respostas.forEach(function (resposta) {
      if (!resposta.ok) console.warn('Filtro não carregado:', resposta.erro);
    });
  }


  /* ===================================================================
   * 6. EXIBIÇÃO DO RESULTADO
   * =================================================================== */

  /* Faixa de erro acima da tabela. Texto vazio esconde a faixa. */
  function mostrarAviso(texto) {
    const aviso = document.getElementById('aviso-erro');
    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }

  /* Cria uma célula de tabela com texto simples (textContent: nada vira HTML). */
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
    tdPrioridade.appendChild(criarEtiqueta(demanda.prioridade));
    tr.appendChild(tdPrioridade);

    const tdStatus = document.createElement('td');
    tdStatus.appendChild(criarEtiqueta(demanda.status));
    tr.appendChild(tdStatus);

    tr.appendChild(criarCelula(demanda.projeto));

    const tdResponsavel = criarCelula(demanda.responsavel || '-');
    tdResponsavel.className = 'coluna-responsavel';
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

    if (totalGeral === null) {
      contador.textContent = exibidas + (exibidas === 1 ? ' demanda encontrada.' : ' demandas encontradas.');
      return;
    }
    contador.textContent = 'Exibindo ' + exibidas + ' de ' + totalGeral +
      (totalGeral === 1 ? ' demanda.' : ' demandas.');
  }


  /* ===================================================================
   * 7. CARGA DA LISTA
   * =================================================================== */

  /*
   * Valida os filtros e, se estiverem corretos, busca a lista na API.
   * "digitando" é true quando a chamada vem da busca por teclas: nesse caso um
   * erro novo da busca ainda não é mostrado (só ao sair do campo), para não
   * acusar erro enquanto a pessoa está no meio da palavra.
   */
  async function carregar(digitando) {
    const filtros = lerFiltros();
    const erros = validarFiltros(filtros);

    Object.keys(IDS).forEach(function (chave) {
      const jaMostrandoErro = campos[chave].classList.contains('invalido');
      const esconderPorEnquanto = digitando && chave === 'busca' && !jaMostrandoErro;
      mostrarErro(chave, esconderPorEnquanto ? '' : (erros[chave] || ''));
    });

    // Filtro inválido: nada é enviado e a tabela continua como estava.
    if (Object.keys(erros).length > 0) {
      return;
    }

    // Mesmo pedido da última vez (ex.: Enter e depois sair do campo): não repete.
    const consulta = montarParametros(filtros).toString();
    if (consulta === ultimaConsulta) {
      return;
    }
    ultimaConsulta = consulta;

    const numero = ++requisicaoAtual;
    const resposta = await chamarApi('GET', '/demandas?' + consulta);

    // Se o usuário mudou um filtro enquanto esta resposta vinha, ela já é antiga.
    if (numero !== requisicaoAtual) {
      return;
    }

    if (!resposta.ok) {
      ultimaConsulta = null; // permite tentar de novo o mesmo pedido
      mostrarAviso(resposta.erro);
      return;
    }
    mostrarAviso('');

    const demandas = resposta.dados.demandas;

    // Sem filtros, a lista é "tudo que o usuário enxerga": serve de base para o total.
    if (!haFiltroAtivo(filtros)) {
      totalGeral = demandas.length;
    }

    mostrarTabela(demandas);
    mostrarContador(demandas.length);
  }


  /* ===================================================================
   * 8. INICIALIZAÇÃO
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

  async function iniciar() {
    // Sem login, usuarioLogado() já manda para a tela de login.
    usuario = usuarioLogado();
    if (!usuario) {
      return;
    }

    Object.keys(IDS).forEach(function (chave) {
      campos[chave] = document.getElementById(IDS[chave]);
    });
    // Sem os campos esperados a tela não tem o que controlar.
    if (Object.keys(campos).some(function (chave) { return !campos[chave]; })) {
      console.error('listagem.js: algum campo de filtro não foi encontrado em listagem.html.');
      return;
    }

    // O botão "Nova demanda" só aparece para quem pode criar demandas.
    if (podeCriarDemanda(usuario)) {
      document.getElementById('botao-nova-demanda').classList.remove('oculto');
    }

    // O Administrador vê tudo; os demais, só os projetos a que estão vinculados.
    if (usuario.perfil !== PERFIS.ADMIN) {
      document.getElementById('subtitulo-listagem').textContent =
        'Demandas dos projetos aos quais você está vinculado';
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

    await carregarOpcoesDaApi();
    carregar(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
