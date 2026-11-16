/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Controle da tela de criacao e edicao de demandas (pages/demanda.html).
 *
 * Responsabilidades deste arquivo:
 *   - descobrir se a tela esta criando ou editando uma demanda (parametro ?id=N);
 *   - preencher os campos de selecao com tipos, prioridades, projetos e usuarios;
 *   - habilitar ou bloquear cada campo conforme as permissoes do perfil logado;
 *   - validar os dados, inclusive o prazo, consultando a API externa de feriados;
 *   - gravar a demanda, registrando automaticamente o historico de alteracoes;
 *   - registrar comentarios e exibir o historico.
 *
 * Integracao com a API (Reuniao 5):
 *   - os projetos do campo de selecao vem de GET /projetos (banco de dados);
 *   - o cadastro envia os dados para POST /demandas, que grava no banco;
 *   - a lista de responsaveis vem de GET /usuarios;
 *   - a edicao carrega a demanda, os comentarios e o historico de GET /demandas/:id
 *     e grava com PATCH /demandas/:id; o historico e registrado pelo servidor;
 *   - o comentario novo vai para POST /demandas/:id/comentarios;
 *   - as mensagens de erro devolvidas pela API (400, 403, 404...) aparecem na tela.
 */

/* Endereco da API do DemandaTrack (backend/, iniciado com "npm run dev"). */
const API_URL = 'http://localhost:3000';

/* Endereco da API externa de feriados nacionais exigida pelo documento de visao. */
const API_FERIADOS = 'https://brasilapi.com.br/api/feriados/v1/';

/* Guarda os feriados ja consultados para nao repetir a chamada a cada validacao. */
const cacheFeriados = {};

/* Demanda em edicao. Fica null quando a tela esta criando uma demanda nova. */
let demandaAtual = null;

/* Usuario autenticado no momento (na simulacao, o escolhido na barra do topo). */
let usuario = null;


/* ==========================================================================
   Inicializacao
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async function () {
  usuario = usuarioLogado();

  await montarListasFixas();

  // O identificador da demanda vem pela URL: demanda.html?id=2
  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get('id');

  if (id) {
    const carga = await carregarDemanda(id);
    if (!carga.ok) {
      mostrarAviso('aviso-erro', 'Nao foi possivel abrir a demanda. ' + carga.mensagem);
      document.getElementById('card-formulario').classList.add('oculto');
      return;
    }
    demandaAtual = carga.demanda;
    prepararModoEdicao();
  } else {
    prepararModoCriacao();
  }

  document.getElementById('formulario-demanda').addEventListener('submit', aoSalvar);
  document.getElementById('botao-cancelar-demanda').addEventListener('click', aoCancelarDemanda);
  document.getElementById('botao-comentar').addEventListener('click', aoComentar);
});


/* ==========================================================================
   Preenchimento dos campos de selecao
   ========================================================================== */

/* Preenche tipo, prioridade, projeto e a lista de responsaveis. */
async function montarListasFixas() {
  // Somente os quatro tipos obrigatorios do documento de visao (item 2.2.1).
  preencherSelect('tipo', TIPOS);
  preencherSelect('prioridade', PRIORIDADES);

  await montarListaDeResponsaveis();

  // Os projetos vem do banco de dados, pela rota GET /projetos da API.
  // O usuario so pode associar a demanda a um projeto ao qual tem acesso.
  const selectProjeto = document.getElementById('projeto');
  selectProjeto.innerHTML = '';

  const resposta = await chamarApi('GET', '/projetos');
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', 'Nao foi possivel carregar os projetos. ' + resposta.mensagem);
    return;
  }

  resposta.dados.projetos.forEach(function (projeto) {
    if (!vinculadoAoProjeto(usuario, projeto.id)) {
      return;
    }
    const opcao = document.createElement('option');
    opcao.value = projeto.id;
    opcao.textContent = projeto.nome;
    selectProjeto.appendChild(opcao);
  });
}

/*
 * Faz uma chamada a API e devolve sempre o mesmo formato, para a tela nao
 * precisar repetir o tratamento de erro:
 *   { ok: true,  dados: <JSON da resposta> }
 *   { ok: false, mensagem: <texto pronto para mostrar ao usuario> }
 *
 * Quando a API recusa a requisicao, ela responde { erro, detalhes }; os dois
 * sao juntados na mensagem. Se o servidor estiver desligado, o fetch falha e
 * a mensagem orienta o usuario.
 */
async function chamarApi(metodo, caminho, corpo) {
  try {
    const resposta = await fetch(API_URL + caminho, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      const detalhes = Array.isArray(dados.detalhes) ? ' ' + dados.detalhes.join(' ') : '';
      return { ok: false, mensagem: (dados.erro || 'Erro ' + resposta.status) + '.' + detalhes };
    }
    return { ok: true, dados: dados };
  } catch (erro) {
    console.warn('Falha ao chamar a API:', erro);
    return { ok: false, mensagem: 'A API nao respondeu. Confira se o servidor esta rodando em ' + API_URL + '.' };
  }
}

/*
 * Busca no banco a demanda da URL, com os comentarios e o historico.
 * Devolve { ok: true, demanda } ou { ok: false, mensagem }.
 *
 * O banco grava tipo, prioridade e status com acento ("Em revisão"); as regras
 * de js/permissoes.js comparam sem acento, por isso os tres sao convertidos.
 * Na gravacao a API aceita os dois jeitos.
 */
async function carregarDemanda(id) {
  const caminho = '/demandas/' + encodeURIComponent(id);
  const respostas = await Promise.all([
    chamarApi('GET', caminho),
    chamarApi('GET', caminho + '/comentarios'),
    chamarApi('GET', caminho + '/historico')
  ]);

  const falha = respostas.find(function (resposta) { return !resposta.ok; });
  if (falha) {
    return { ok: false, mensagem: falha.mensagem };
  }

  const demanda = respostas[0].dados.demanda;
  demanda.tipo = semAcento(demanda.tipo);
  demanda.prioridade = semAcento(demanda.prioridade);
  demanda.status = semAcento(demanda.status);
  demanda.responsaveisIds = demanda.responsavelId ? [demanda.responsavelId] : [];
  demanda.comentarios = respostas[1].dados.comentarios;
  demanda.historico = respostas[2].dados.historico;
  return { ok: true, demanda: demanda };
}

/*
 * Monta uma caixa de marcacao para cada usuario cadastrado no banco (GET /usuarios).
 * A demanda pode ficar sem responsavel ou ter um.
 */
async function montarListaDeResponsaveis() {
  const lista = document.getElementById('lista-responsaveis');
  lista.innerHTML = '';

  const resposta = await chamarApi('GET', '/usuarios');
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', 'Nao foi possivel carregar os usuarios. ' + resposta.mensagem);
    return;
  }

  resposta.dados.forEach(function (item) {
    const opcao = document.createElement('label');
    opcao.className = 'opcao-responsavel';

    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.value = item.id;
    caixa.className = 'caixa-responsavel';

    // Destaca a linha enquanto o usuario estiver marcado.
    caixa.addEventListener('change', function () {
      opcao.classList.toggle('marcada', caixa.checked);
    });

    const nome = document.createElement('span');
    nome.textContent = item.nome;

    const perfil = document.createElement('span');
    perfil.className = 'perfil-responsavel';
    perfil.textContent = item.perfil;

    opcao.appendChild(caixa);
    opcao.appendChild(nome);
    opcao.appendChild(perfil);
    lista.appendChild(opcao);
  });
}

/* Ids dos responsaveis marcados na tela, na ordem em que aparecem na lista. */
function responsaveisMarcados() {
  const marcadas = document.querySelectorAll('.caixa-responsavel:checked');
  return Array.from(marcadas).map(function (caixa) { return Number(caixa.value); });
}

/* Marca na tela as caixas correspondentes aos responsaveis da demanda. */
function marcarResponsaveis(ids) {
  const listaIds = ids || [];
  document.querySelectorAll('.caixa-responsavel').forEach(function (caixa) {
    caixa.checked = listaIds.indexOf(Number(caixa.value)) >= 0;
    caixa.closest('.opcao-responsavel').classList.toggle('marcada', caixa.checked);
  });
}

function preencherSelect(id, valores) {
  const select = document.getElementById(id);
  select.innerHTML = '';
  valores.forEach(function (valor) {
    const opcao = document.createElement('option');
    opcao.value = valor;
    opcao.textContent = valor;
    select.appendChild(opcao);
  });
}


/* ==========================================================================
   Modo de criacao
   ========================================================================== */

function prepararModoCriacao() {
  document.getElementById('titulo-pagina').textContent = 'Nova Demanda';
  document.getElementById('subtitulo-pagina').textContent =
    'Preencha os dados para cadastrar uma nova demanda no sistema';

  // Somente Administrador e Lider de Projeto podem criar demandas.
  if (!podeCriarDemanda(usuario)) {
    mostrarAviso('aviso-permissao',
      'Seu perfil (' + usuario.perfil + ') nao pode criar demandas. ' +
      'A criacao e permitida ao Administrador e ao Lider de Projeto.');
    bloquearFormulario();
    return;
  }

  // O Lider precisa estar vinculado a pelo menos um projeto para criar demandas.
  if (document.getElementById('projeto').options.length === 0) {
    mostrarAviso('aviso-permissao',
      'Voce nao esta vinculado a nenhum projeto, portanto nao pode criar demandas.');
    bloquearFormulario();
    return;
  }

  // Toda demanda nasce com o status Aberta, por isso o campo nao e exibido aqui.
  mostrarAviso('aviso-permissao',
    'A demanda sera cadastrada com o status Aberta. O status podera ser alterado depois, na edicao.');
}


/* ==========================================================================
   Modo de edicao
   ========================================================================== */

function prepararModoEdicao() {
  document.getElementById('titulo-pagina').textContent = 'Editar Demanda';
  document.getElementById('subtitulo-pagina').textContent =
    'Consulte e atualize os dados da demanda conforme as suas permissoes';

  // Quem nao esta vinculado ao projeto nao pode nem visualizar a demanda.
  if (!podeVisualizar(usuario, demandaAtual)) {
    mostrarAviso('aviso-permissao', motivoSomenteLeitura(usuario, demandaAtual));
    document.getElementById('card-formulario').classList.add('oculto');
    return;
  }

  preencherFormulario();
  montarStatusDisponiveis();
  aplicarPermissoes();
  renderizarComentarios();
  renderizarHistorico();

  document.getElementById('resumo-demanda').classList.remove('oculto');
  document.getElementById('datas-demanda').classList.remove('oculto');
  document.getElementById('campo-status').classList.remove('oculto');
  document.getElementById('card-comentarios').classList.remove('oculto');
  document.getElementById('card-historico').classList.remove('oculto');
}

/* Copia os dados da demanda para os campos da tela. */
function preencherFormulario() {
  document.getElementById('titulo').value = demandaAtual.titulo;
  document.getElementById('descricao').value = demandaAtual.descricao;
  document.getElementById('prioridade').value = demandaAtual.prioridade;
  document.getElementById('prazo').value = demandaAtual.prazo || '';

  document.getElementById('tipo').value = demandaAtual.tipo;

  marcarResponsaveis(demandaAtual.responsaveisIds);

  /*
   * O projeto da demanda pode nao estar na lista de projetos do usuario logado.
   * Nesse caso a opcao e acrescentada apenas para exibicao, e o campo fica
   * bloqueado mais adiante em aplicarPermissoes().
   */
  const selectProjeto = document.getElementById('projeto');
  if (!selectProjeto.querySelector('option[value="' + demandaAtual.projetoId + '"]')) {
    const opcao = document.createElement('option');
    opcao.value = demandaAtual.projetoId;
    opcao.textContent = demandaAtual.projeto;
    selectProjeto.appendChild(opcao);
  }
  selectProjeto.value = demandaAtual.projetoId;

  // Identificacao e etiquetas do topo
  document.getElementById('codigo-demanda').textContent = 'Demanda #' + demandaAtual.id;
  aplicarEtiqueta('etiqueta-status', demandaAtual.status);
  aplicarEtiqueta('etiqueta-prioridade', demandaAtual.prioridade);

  document.getElementById('data-criacao').textContent = formatarDataHora(demandaAtual.dataCriacao);
  document.getElementById('data-atualizacao').textContent = formatarDataHora(demandaAtual.dataAtualizacao);
}

/*
 * Monta a lista de status com o status atual mais as transicoes permitidas ao
 * perfil. Assim o usuario nunca consegue escolher uma transicao invalida.
 */
function montarStatusDisponiveis() {
  const select = document.getElementById('status');
  const disponiveis = statusDisponiveis(usuario, demandaAtual);

  select.innerHTML = '';

  const atual = document.createElement('option');
  atual.value = demandaAtual.status;
  atual.textContent = demandaAtual.status + ' (atual)';
  select.appendChild(atual);

  disponiveis.forEach(function (status) {
    const opcao = document.createElement('option');
    opcao.value = status;
    opcao.textContent = status;
    select.appendChild(opcao);
  });

  select.value = demandaAtual.status;

  const ajuda = document.getElementById('ajuda-status');
  if (disponiveis.length === 0) {
    select.disabled = true;
    ajuda.textContent = 'Nenhuma mudanca de status esta disponivel para o seu perfil nesta demanda.';
  } else {
    ajuda.textContent = 'Transicoes permitidas: ' + disponiveis.join(', ') + '.';
  }
}


/* ==========================================================================
   Aplicacao das permissoes sobre os campos
   ========================================================================== */

/*
 * Bloqueia cada campo de acordo com o que o perfil pode fazer.
 * As mesmas regras precisam ser repetidas no backend: bloquear apenas na tela
 * nao impede que alguem envie a requisicao diretamente para a API.
 */
function aplicarPermissoes() {
  const podeEditar = podeEditarDemanda(usuario, demandaAtual);
  const podeMexerNoStatus = statusDisponiveis(usuario, demandaAtual).length > 0;

  // Dados gerais da demanda
  document.getElementById('titulo').disabled = !podeEditar;
  document.getElementById('descricao').disabled = !podeEditar;
  document.getElementById('tipo').disabled = !podeEditar;
  document.getElementById('prazo').disabled = !podeEditar;

  // Prioridade e responsaveis tem permissao propria no documento de visao
  document.getElementById('prioridade').disabled = !podeAlterarPrioridade(usuario, demandaAtual);

  const liberaResponsaveis = podeAlterarResponsavel(usuario, demandaAtual);
  document.querySelectorAll('.caixa-responsavel').forEach(function (caixa) {
    caixa.disabled = !liberaResponsaveis;
  });
  document.getElementById('lista-responsaveis').classList.toggle('bloqueada', !liberaResponsaveis);

  // O projeto associado nao muda depois que a demanda existe
  document.getElementById('projeto').disabled = true;

  // Botao salvar: so faz sentido se houver algo que o usuario possa alterar
  document.getElementById('botao-salvar').disabled = !podeEditar && !podeMexerNoStatus;

  // Cancelar a demanda e uma acao restrita ao Administrador e ao Lider
  if (podeCancelar(usuario, demandaAtual)) {
    document.getElementById('botao-cancelar-demanda').classList.remove('oculto');
  }

  // Comentarios sao permitidos a todos os perfis que enxergam a demanda
  const liberaComentario = podeComentar(usuario, demandaAtual);
  document.getElementById('novo-comentario').disabled = !liberaComentario;
  document.getElementById('botao-comentar').disabled = !liberaComentario;

  // Explica ao usuario por que a tela esta parcialmente bloqueada
  const motivo = motivoSomenteLeitura(usuario, demandaAtual);
  if (motivo) {
    mostrarAviso('aviso-permissao', motivo);
  }
}

/* Deixa o formulario inteiro somente leitura. */
function bloquearFormulario() {
  const formulario = document.getElementById('formulario-demanda');
  const campos = formulario.querySelectorAll('input, select, textarea, button');
  campos.forEach(function (campo) {
    campo.disabled = true;
  });
}


/* ==========================================================================
   Validacao
   ========================================================================== */

/*
 * Valida os campos obrigatorios e o prazo.
 * Retorna true quando os dados podem ser gravados.
 */
async function validarFormulario() {
  limparErros();
  let valido = true;

  const titulo = document.getElementById('titulo').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const prazo = document.getElementById('prazo').value;

  if (titulo.length < 5) {
    marcarErro('titulo', 'Informe um titulo com pelo menos 5 caracteres.');
    valido = false;
  }

  if (descricao.length < 10) {
    marcarErro('descricao', 'Descreva a demanda com pelo menos 10 caracteres.');
    valido = false;
  }

  if (!document.getElementById('projeto').value) {
    marcarErro('projeto', 'Selecione o projeto ao qual a demanda pertence.');
    valido = false;
  }

  // No banco a demanda tem um unico responsavel (pode ficar em branco).
  if (responsaveisMarcados().length > 1) {
    marcarErro('responsaveis', 'Selecione no maximo um responsavel.');
    valido = false;
  }

  // Na edicao, o prazo que ja estava gravado nao e conferido de novo: uma demanda
  // antiga com prazo vencido ainda precisa aceitar mudanca de status.
  const prazoMudou = !demandaAtual || prazo !== (demandaAtual.prazo || '');

  if (prazo && prazoMudou) {
    // O prazo nao pode ser uma data ja passada.
    if (prazo < dataDeHoje()) {
      marcarErro('prazo', 'O prazo de finalizacao nao pode ser uma data passada.');
      valido = false;
    } else {
      // Regra obrigatoria: o prazo nao pode cair em um feriado nacional.
      const feriado = await verificarFeriado(prazo);
      if (feriado.ehFeriado) {
        marcarErro('prazo', 'A data informada e um feriado nacional (' + feriado.nome + '). Escolha outra data.');
        valido = false;
      } else if (feriado.indisponivel) {
        // A API pode estar fora do ar; o usuario e avisado de que nao houve conferencia.
        mostrarAviso('aviso-erro',
          'Nao foi possivel consultar a API de feriados nacionais. O prazo sera gravado sem essa conferencia.');
      }
    }
  }

  return valido;
}

/*
 * Consulta a API externa de feriados nacionais para a data informada.
 * Retorna { ehFeriado, nome, indisponivel }.
 */
async function verificarFeriado(data) {
  const ano = data.substring(0, 4);

  try {
    // Cada ano e consultado uma unica vez e guardado em memoria.
    if (!cacheFeriados[ano]) {
      const resposta = await fetch(API_FERIADOS + ano);
      if (!resposta.ok) {
        return { ehFeriado: false, nome: '', indisponivel: true };
      }
      cacheFeriados[ano] = await resposta.json();
    }

    const encontrado = cacheFeriados[ano].find(function (feriado) {
      return feriado.date === data;
    });

    return {
      ehFeriado: !!encontrado,
      nome: encontrado ? encontrado.name : '',
      indisponivel: false
    };
  } catch (erro) {
    console.warn('Falha ao consultar a API de feriados:', erro);
    return { ehFeriado: false, nome: '', indisponivel: true };
  }
}


/* ==========================================================================
   Gravacao da demanda
   ========================================================================== */

async function aoSalvar(evento) {
  evento.preventDefault();
  esconderAvisos();

  const botao = document.getElementById('botao-salvar');
  botao.disabled = true;
  botao.textContent = 'Salvando...';

  try {
    const valido = await validarFormulario();
    if (!valido) {
      return;
    }

    if (demandaAtual) {
      await atualizarDemanda();
    } else {
      await criarDemanda();
    }
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar demanda';
    // Na edicao o botao volta ao estado que as permissoes mandam
    // (uma demanda recem-concluida, por exemplo, nao aceita mais gravacao).
    if (demandaAtual) {
      aplicarPermissoes();
    }
  }
}

/*
 * Cria uma nova demanda enviando os dados para POST /demandas.
 * Status, data de criacao e data de atualizacao nao sao enviados: quem define
 * e o servidor. A API repete as validacoes e grava a demanda e o historico no banco.
 */
async function criarDemanda() {
  const resposta = await chamarApi('POST', '/demandas', {
    titulo: document.getElementById('titulo').value.trim(),
    descricao: document.getElementById('descricao').value.trim(),
    tipo: document.getElementById('tipo').value,
    prioridade: document.getElementById('prioridade').value,
    projetoId: Number(document.getElementById('projeto').value),
    responsavelId: responsaveisMarcados()[0] || null,
    prazo: document.getElementById('prazo').value || null,
    usuarioId: usuario.id
  });

  // Erro devolvido pela API (dados invalidos, sem permissao, feriado...) vai para a tela.
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', resposta.mensagem);
    return;
  }

  const criada = resposta.dados.demanda;
  mostrarAviso('aviso-sucesso',
    'Demanda #' + criada.id + ' gravada no banco de dados com o status ' + criada.status +
    ', em ' + formatarDataHora(criada.dataCriacao) + '.');

  // A API avisa quando nao conseguiu conferir o prazo na API de feriados.
  if (resposta.dados.aviso) {
    mostrarAviso('aviso-info', resposta.dados.aviso);
  }

  // Limpa o formulario para um novo cadastro.
  document.getElementById('formulario-demanda').reset();
  marcarResponsaveis([]);
}

/*
 * Atualiza a demanda existente com PATCH /demandas/:id.
 * A tela envia os campos que o perfil pode alterar; o servidor compara com o
 * que esta gravado, confere permissao e fluxo de status, grava so o que mudou
 * e registra uma linha de historico para cada campo alterado.
 */
async function atualizarDemanda() {
  const alteracoes = {};

  if (podeEditarDemanda(usuario, demandaAtual)) {
    alteracoes.titulo = document.getElementById('titulo').value.trim();
    alteracoes.descricao = document.getElementById('descricao').value.trim();
    alteracoes.tipo = document.getElementById('tipo').value;
    alteracoes.prioridade = document.getElementById('prioridade').value;
    alteracoes.prazo = document.getElementById('prazo').value || null;
    alteracoes.responsavelId = responsaveisMarcados()[0] || null;
  }

  const novoStatus = document.getElementById('status').value;
  if (novoStatus !== demandaAtual.status) {
    alteracoes.status = novoStatus;
  }

  if (Object.keys(alteracoes).length === 0) {
    mostrarAviso('aviso-info', 'Nenhuma alteracao foi identificada.');
    return;
  }

  await enviarAlteracoes(alteracoes, 'Demanda atualizada no banco de dados.');
}

/*
 * Cancelar a demanda.
 * Nao existe exclusao fisica de registros: o cancelamento apenas grava o status
 * Cancelada, preservando todo o historico das atividades.
 */
async function aoCancelarDemanda() {
  esconderAvisos();

  if (!podeCancelar(usuario, demandaAtual)) {
    mostrarAviso('aviso-erro', 'Seu perfil nao pode cancelar demandas.');
    return;
  }

  await enviarAlteracoes({ status: STATUS.CANCELADA },
    'Demanda cancelada. O registro e o historico foram preservados.');
}

/* Envia as alteracoes para a API, recarrega a demanda do banco e redesenha a tela. */
async function enviarAlteracoes(alteracoes, mensagemDeSucesso) {
  alteracoes.usuarioId = usuario.id;

  const resposta = await chamarApi('PATCH', '/demandas/' + demandaAtual.id, alteracoes);
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', resposta.mensagem);
    return;
  }

  // Quando nada mudou, a API devolve a demanda com a mesma data de atualizacao.
  if (resposta.dados.demanda.dataAtualizacao === demandaAtual.dataAtualizacao) {
    mostrarAviso('aviso-info', 'Nenhuma alteracao foi identificada.');
    return;
  }

  const carga = await carregarDemanda(demandaAtual.id);
  if (carga.ok) {
    demandaAtual = carga.demanda;
    redesenharTela();
  }

  mostrarAviso('aviso-sucesso', mensagemDeSucesso);
  if (resposta.dados.aviso) {
    mostrarAviso('aviso-info', resposta.dados.aviso);
  }
}

/* Reaplica dados e permissoes apos uma gravacao, sem recarregar a pagina. */
function redesenharTela() {
  preencherFormulario();
  montarStatusDisponiveis();
  document.getElementById('botao-cancelar-demanda').classList.add('oculto');
  aplicarPermissoes();
  renderizarHistorico();
}


/* ==========================================================================
   Comentarios
   ========================================================================== */

async function aoComentar() {
  esconderAvisos();
  limparErros();

  if (!podeComentar(usuario, demandaAtual)) {
    mostrarAviso('aviso-erro', 'Voce nao pode comentar nesta demanda.');
    return;
  }

  const campo = document.getElementById('novo-comentario');
  const texto = campo.value.trim();

  if (texto.length < 3) {
    marcarErro('comentario', 'Escreva um comentario com pelo menos 3 caracteres.');
    return;
  }

  // O servidor grava o comentario com o usuario e a data/hora do registro.
  const resposta = await chamarApi('POST', '/demandas/' + demandaAtual.id + '/comentarios', {
    usuarioId: usuario.id,
    texto: texto
  });
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', resposta.mensagem);
    return;
  }

  demandaAtual.comentarios.push(resposta.dados.comentario);

  campo.value = '';
  renderizarComentarios();
  mostrarAviso('aviso-sucesso', 'Comentario gravado no banco de dados.');
}

function renderizarComentarios() {
  const lista = document.getElementById('lista-comentarios');
  lista.innerHTML = '';

  if (!demandaAtual.comentarios || demandaAtual.comentarios.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'lista-vazia';
    vazio.textContent = 'Nenhum comentario registrado ate o momento.';
    lista.appendChild(vazio);
    return;
  }

  demandaAtual.comentarios.forEach(function (comentario) {
    const item = document.createElement('div');
    item.className = 'comentario';

    const topo = document.createElement('div');
    topo.className = 'comentario-topo';

    const autor = document.createElement('span');
    autor.className = 'comentario-autor';
    autor.textContent = comentario.autor;

    const data = document.createElement('span');
    data.className = 'comentario-data';
    data.textContent = formatarDataHora(comentario.data);

    topo.appendChild(autor);
    topo.appendChild(data);

    const texto = document.createElement('p');
    texto.className = 'comentario-texto';
    // textContent evita que o conteudo digitado seja interpretado como HTML.
    texto.textContent = comentario.texto;

    item.appendChild(topo);
    item.appendChild(texto);
    lista.appendChild(item);
  });
}


/* ==========================================================================
   Historico de alteracoes
   ========================================================================== */

function renderizarHistorico() {
  const lista = document.getElementById('lista-historico');
  lista.innerHTML = '';

  if (!demandaAtual.historico || demandaAtual.historico.length === 0) {
    const vazio = document.createElement('li');
    vazio.className = 'lista-vazia';
    vazio.textContent = 'Nenhum registro de alteracao.';
    lista.appendChild(vazio);
    return;
  }

  // Do registro mais recente para o mais antigo.
  const registros = demandaAtual.historico.slice().reverse();

  registros.forEach(function (registro) {
    const item = document.createElement('li');

    const data = document.createElement('span');
    data.className = 'historico-data';
    data.textContent = formatarDataHora(registro.data);

    const texto = document.createElement('span');
    texto.textContent = registro.autor + ' ' + registro.descricao;

    item.appendChild(data);
    item.appendChild(texto);
    lista.appendChild(item);
  });
}


/* ==========================================================================
   Funcoes auxiliares de tela
   ========================================================================== */

/* Aplica a etiqueta colorida de status ou de prioridade. */
function aplicarEtiqueta(idElemento, valor) {
  const elemento = document.getElementById(idElemento);
  elemento.textContent = valor;
  elemento.className = 'etiqueta ' + classeDaEtiqueta(valor);
}

/* Exibe um dos avisos do topo da tela. */
function mostrarAviso(id, mensagem) {
  const elemento = document.getElementById(id);
  elemento.textContent = mensagem;
  elemento.classList.remove('oculto');
}

function esconderAvisos() {
  ['aviso-erro', 'aviso-sucesso', 'aviso-info'].forEach(function (id) {
    document.getElementById(id).classList.add('oculto');
  });
}

/* Mostra a mensagem de erro logo abaixo do campo correspondente. */
function marcarErro(campo, mensagem) {
  document.getElementById('erro-' + campo).textContent = mensagem;
  const container = document.getElementById('campo-' + campo);
  if (container) {
    container.classList.add('invalido');
  }
}

function limparErros() {
  document.querySelectorAll('.erro-campo').forEach(function (elemento) {
    elemento.textContent = '';
  });
  document.querySelectorAll('.campo.invalido').forEach(function (elemento) {
    elemento.classList.remove('invalido');
  });
}
