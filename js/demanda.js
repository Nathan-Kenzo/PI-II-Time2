/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descrição: Controle da tela de criação e edição de demandas (pages/demanda.html).
 *
 * Responsabilidades deste arquivo:
 *   - descobrir se a tela está criando ou abrindo uma demanda (parâmetro ?id=N);
 *   - preencher os campos de seleção com tipos, prioridades, projetos e usuários;
 *   - habilitar ou bloquear cada campo conforme as permissões do perfil logado;
 *   - validar os dados, inclusive o prazo, consultando a API externa de feriados;
 *   - gravar a demanda (o histórico de alterações é registrado pelo servidor);
 *   - registrar comentários e exibir o histórico.
 *
 * Integração com a API (chamarApi e usuarioLogado estão em js/dados.js):
 *   - os projetos do campo de seleção vêm de GET /projetos?usuarioId=;
 *   - os responsáveis vêm de GET /usuarios?projetoId= (só os vinculados ao projeto);
 *   - o cadastro envia os dados para POST /demandas;
 *   - a demanda, os comentários e o histórico vêm de GET /demandas/:id?usuarioId=
 *     (e das rotas /comentarios e /historico); a API responde 403 para quem não
 *     tem acesso ao projeto da demanda;
 *   - a edição grava com PATCH /demandas/:id;
 *   - o comentário novo vai para POST /demandas/:id/comentarios;
 *   - as mensagens de erro devolvidas pela API (400, 403, 404...) aparecem na tela.
 */

/* Endereço da API externa de feriados nacionais exigida pelo documento de visão. */
const API_FERIADOS = 'https://brasilapi.com.br/api/feriados/v1/';

/* Guarda os feriados já consultados para não repetir a chamada a cada validação. */
const cacheFeriados = {};

/* Demanda aberta na tela. Fica null quando a tela está criando uma demanda nova. */
let demandaAtual = null;

/* Usuário autenticado no momento (gravado pela tela de login). */
let usuario = null;


/* ==========================================================================
   Inicialização
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async function () {
  // Sem login, usuarioLogado() já manda para a tela de login.
  usuario = usuarioLogado();
  if (!usuario) {
    return;
  }

  // O identificador da demanda vem pela URL: demanda.html?id=2
  const id = new URLSearchParams(window.location.search).get('id');

  // Título e menu são definidos antes de qualquer carga, para não aparecer
  // "Nova Demanda" por um instante quando a tela abre uma demanda existente.
  if (id) {
    definirTitulo('Detalhes da Demanda', 'Consulte os dados, os comentários e o histórico da demanda');
    document.getElementById('menu-demandas').classList.add('ativo');
  } else {
    if (!podeCriarDemanda(usuario)) {
      alert('Seu perfil (' + usuario.perfil + ') não pode criar demandas. ' +
        'A criação é permitida ao Administrador e ao Líder de Projeto.');
      window.location.href = 'listagem.html';
      return;
    }
    definirTitulo('Nova Demanda', 'Preencha os dados para cadastrar uma nova demanda no sistema');
    document.getElementById('menu-nova-demanda').classList.add('ativo');
  }

  const listasCarregadas = await montarListasFixas();

  if (id) {
    const carga = await carregarDemanda(id);
    if (!carga.ok) {
      mostrarAviso('aviso-erro', carga.status === 403
        ? 'Você não tem acesso a esta demanda.'
        : 'Não foi possível abrir a demanda. ' + carga.erro);
      document.getElementById('card-formulario').classList.add('oculto');
      return;
    }
    demandaAtual = carga.demanda;
    await prepararModoEdicao();
  } else {
    await prepararModoCriacao(listasCarregadas);
  }

  document.getElementById('formulario-demanda').addEventListener('submit', aoSalvar);
  document.getElementById('botao-cancelar-demanda').addEventListener('click', aoCancelarDemanda);
  document.getElementById('botao-comentar').addEventListener('click', aoComentar);
});

function definirTitulo(titulo, subtitulo) {
  document.getElementById('titulo-pagina').textContent = titulo;
  document.getElementById('subtitulo-pagina').textContent = subtitulo;
}


/* ==========================================================================
   Preenchimento dos campos de seleção
   ========================================================================== */

/* Preenche tipo, prioridade e projeto. Devolve false se a API falhar. */
async function montarListasFixas() {
  // Somente os quatro tipos obrigatórios do documento de visão (item 2.2.1).
  preencherSelect('tipo', TIPOS);
  preencherSelect('prioridade', PRIORIDADES);

  // A API devolve só os projetos que o usuário enxerga (o Administrador vê todos).
  const selectProjeto = document.getElementById('projeto');
  selectProjeto.innerHTML = '';

  const resposta = await chamarApi('GET', '/projetos?usuarioId=' + encodeURIComponent(usuario.id));
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', 'Não foi possível carregar os projetos. ' + resposta.erro);
    return false;
  }

  resposta.dados.projetos.forEach(function (projeto) {
    const opcao = document.createElement('option');
    opcao.value = projeto.id;
    opcao.textContent = projeto.nome;
    selectProjeto.appendChild(opcao);
  });
  return true;
}

/*
 * Preenche o campo Responsável com os usuários vinculados ao projeto
 * (GET /usuarios?projetoId=). A primeira opção deixa a demanda sem responsável.
 */
async function montarResponsaveis(projetoId) {
  const select = document.getElementById('responsavel');
  let usuarios = [];

  if (projetoId) {
    const resposta = await chamarApi('GET', '/usuarios?projetoId=' + encodeURIComponent(projetoId));
    if (resposta.ok) {
      usuarios = resposta.dados.usuarios;
    } else {
      mostrarAviso('aviso-erro', 'Não foi possível carregar os usuários do projeto. ' + resposta.erro);
    }
  }

  // A lista é limpa só depois da resposta, para duas cargas seguidas não somarem opções.
  select.innerHTML = '';
  const nenhum = document.createElement('option');
  nenhum.value = '';
  nenhum.textContent = '(sem responsável)';
  select.appendChild(nenhum);

  usuarios.forEach(function (item) {
    const opcao = document.createElement('option');
    opcao.value = item.id;
    opcao.textContent = item.nome + ' (' + item.perfil + ')';
    select.appendChild(opcao);
  });
}

/* Id do responsável escolhido, ou null quando a demanda fica sem responsável. */
function responsavelEscolhido() {
  const valor = document.getElementById('responsavel').value;
  return valor ? Number(valor) : null;
}

/*
 * Busca no banco a demanda da URL, com os comentários e o histórico.
 * Devolve { ok: true, demanda } ou { ok: false, status, erro }.
 */
async function carregarDemanda(id) {
  const caminho = '/demandas/' + encodeURIComponent(id);
  const consulta = '?usuarioId=' + encodeURIComponent(usuario.id);
  const respostas = await Promise.all([
    chamarApi('GET', caminho + consulta),
    chamarApi('GET', caminho + '/comentarios' + consulta),
    chamarApi('GET', caminho + '/historico' + consulta)
  ]);

  const falha = respostas.find(function (resposta) { return !resposta.ok; });
  if (falha) {
    return { ok: false, status: falha.status, erro: falha.erro };
  }

  const demanda = respostas[0].dados.demanda;
  demanda.comentarios = respostas[1].dados.comentarios;
  demanda.historico = respostas[2].dados.historico;
  return { ok: true, demanda: demanda };
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
   Modo de criação
   ========================================================================== */

async function prepararModoCriacao(listasCarregadas) {
  const selectProjeto = document.getElementById('projeto');

  // O Líder precisa estar vinculado a pelo menos um projeto para criar demandas.
  // Se a API falhou, o erro já foi mostrado e o aviso de vínculo seria falso.
  if (!listasCarregadas || selectProjeto.options.length === 0) {
    if (listasCarregadas) {
      mostrarAviso('aviso-permissao',
        'Você não está vinculado a nenhum projeto, portanto não pode criar demandas.');
    }
    await montarResponsaveis(null);
    bloquearFormulario();
    return;
  }

  // Os responsáveis dependem do projeto: a lista é refeita quando o projeto muda.
  await montarResponsaveis(selectProjeto.value);
  selectProjeto.addEventListener('change', function () {
    montarResponsaveis(selectProjeto.value);
  });

  // O prazo não pode ser uma data passada.
  document.getElementById('prazo').min = dataDeHoje();

  // Toda demanda nasce com o status Aberta, por isso o campo não é exibido aqui.
  mostrarAviso('aviso-permissao',
    'A demanda será cadastrada com o status Aberta. O status poderá ser alterado depois, na edição.');
}


/* ==========================================================================
   Modo de edição (ou só leitura)
   ========================================================================== */

async function prepararModoEdicao() {
  if (podeEditarDemanda(usuario, demandaAtual)) {
    definirTitulo('Editar Demanda', 'Consulte e atualize os dados da demanda conforme as suas permissões');
  }

  await montarResponsaveis(demandaAtual.projetoId);

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

/*
 * Se o valor gravado não estiver entre as opções do select (por exemplo, a
 * lista não carregou), acrescenta a opção só para exibição.
 */
function garantirOpcao(select, valor, texto) {
  if (!select.querySelector('option[value="' + valor + '"]')) {
    const opcao = document.createElement('option');
    opcao.value = valor;
    opcao.textContent = texto;
    select.appendChild(opcao);
  }
  select.value = valor;
}

/* Copia os dados da demanda para os campos da tela. */
function preencherFormulario() {
  document.getElementById('titulo').value = demandaAtual.titulo;
  document.getElementById('descricao').value = demandaAtual.descricao;
  document.getElementById('prioridade').value = demandaAtual.prioridade;
  document.getElementById('prazo').value = demandaAtual.prazo || '';
  document.getElementById('tipo').value = demandaAtual.tipo;

  garantirOpcao(document.getElementById('projeto'), demandaAtual.projetoId, demandaAtual.projeto);

  const selectResponsavel = document.getElementById('responsavel');
  if (demandaAtual.responsavelId === null) {
    selectResponsavel.value = '';
  } else {
    garantirOpcao(selectResponsavel, demandaAtual.responsavelId, demandaAtual.responsavel);
  }

  // Identificação e etiquetas do topo
  document.getElementById('codigo-demanda').textContent = 'Demanda #' + demandaAtual.id;
  aplicarEtiqueta('etiqueta-status', demandaAtual.status);
  aplicarEtiqueta('etiqueta-prioridade', demandaAtual.prioridade);

  document.getElementById('data-criacao').textContent = formatarDataHora(demandaAtual.dataCriacao);
  document.getElementById('data-atualizacao').textContent = formatarDataHora(demandaAtual.dataAtualizacao);
}

/*
 * Monta a lista de status com o status atual mais as transições permitidas ao
 * perfil. Assim o usuário nunca consegue escolher uma transição inválida.
 * Cancelada fica de fora: o cancelamento é feito pelo botão "Cancelar demanda",
 * que pede confirmação.
 */
function montarStatusDisponiveis() {
  const select = document.getElementById('status');
  const disponiveis = statusDisponiveis(usuario, demandaAtual).filter(function (status) {
    return status !== STATUS.CANCELADA;
  });

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
  select.disabled = disponiveis.length === 0;
  if (disponiveis.length === 0) {
    ajuda.textContent = 'Nenhuma mudança de status está disponível para o seu perfil nesta demanda.';
  } else {
    ajuda.textContent = 'Transições permitidas: ' + disponiveis.join(', ') + '.';
  }
}


/* ==========================================================================
   Aplicação das permissões sobre os campos
   ========================================================================== */

/*
 * Bloqueia cada campo de acordo com o que o perfil pode fazer.
 * As mesmas regras são repetidas no backend: bloquear apenas na tela
 * não impede que alguém envie a requisição diretamente para a API.
 */
function aplicarPermissoes() {
  const podeEditar = podeEditarDemanda(usuario, demandaAtual);
  const podeMexerNoStatus = !document.getElementById('status').disabled;

  // Dados gerais da demanda
  document.getElementById('titulo').disabled = !podeEditar;
  document.getElementById('descricao').disabled = !podeEditar;
  document.getElementById('tipo').disabled = !podeEditar;
  document.getElementById('prazo').disabled = !podeEditar;

  // Prioridade e responsável têm permissão própria no documento de visão
  document.getElementById('prioridade').disabled = !podeAlterarPrioridade(usuario, demandaAtual);
  document.getElementById('responsavel').disabled = !podeAlterarResponsavel(usuario, demandaAtual);

  // O projeto associado não muda depois que a demanda existe
  document.getElementById('projeto').disabled = true;

  // Botão salvar: só faz sentido se houver algo que o usuário possa alterar
  document.getElementById('botao-salvar').disabled = !podeEditar && !podeMexerNoStatus;

  // Cancelar a demanda é uma ação restrita ao Administrador e ao Líder
  document.getElementById('botao-cancelar-demanda').classList.toggle('oculto', !podeCancelar(usuario, demandaAtual));

  // Comentários são permitidos a todos os perfis que enxergam a demanda
  const liberaComentario = podeComentar(usuario, demandaAtual);
  document.getElementById('novo-comentario').disabled = !liberaComentario;
  document.getElementById('botao-comentar').disabled = !liberaComentario;

  // Explica ao usuário por que a tela está parcialmente bloqueada
  const motivo = motivoSomenteLeitura(usuario, demandaAtual);
  if (motivo) {
    mostrarAviso('aviso-permissao', motivo);
  }
}

/* Deixa o formulário inteiro somente leitura. */
function bloquearFormulario() {
  const formulario = document.getElementById('formulario-demanda');
  const campos = formulario.querySelectorAll('input, select, textarea, button');
  campos.forEach(function (campo) {
    campo.disabled = true;
  });
}


/* ==========================================================================
   Validação
   ========================================================================== */

/*
 * Valida os campos obrigatórios e o prazo.
 * Retorna true quando os dados podem ser gravados.
 */
async function validarFormulario() {
  limparErros();
  let valido = true;

  const titulo = document.getElementById('titulo').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const prazo = document.getElementById('prazo').value;

  if (titulo.length < 5) {
    marcarErro('titulo', 'Informe um título com pelo menos 5 caracteres.');
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

  // Na edição, o prazo que já estava gravado não é conferido de novo: uma demanda
  // antiga com prazo vencido ainda precisa aceitar mudança de status.
  const prazoMudou = !demandaAtual || prazo !== (demandaAtual.prazo || '');

  if (prazo && prazoMudou) {
    // O prazo não pode ser uma data já passada.
    if (prazo < dataDeHoje()) {
      marcarErro('prazo', 'O prazo de finalização não pode ser uma data passada.');
      valido = false;
    } else {
      // Regra obrigatória: o prazo não pode cair em um feriado nacional.
      const feriado = await verificarFeriado(prazo);
      if (feriado.ehFeriado) {
        marcarErro('prazo', 'A data informada é um feriado nacional (' + feriado.nome + '). Escolha outra data.');
        valido = false;
      } else if (feriado.indisponivel) {
        // A API pode estar fora do ar; o usuário é avisado de que não houve conferência.
        mostrarAviso('aviso-erro',
          'Não foi possível consultar a API de feriados nacionais. O prazo será gravado sem essa conferência.');
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
    // Cada ano é consultado uma única vez e guardado em memória.
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
   Gravação da demanda
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
    // Na edição o botão volta ao estado que as permissões mandam
    // (uma demanda recém-concluída, por exemplo, não aceita mais gravação).
    if (demandaAtual) {
      aplicarPermissoes();
    }
  }
}

/*
 * Cria uma nova demanda enviando os dados para POST /demandas.
 * Status, data de criação e data de atualização não são enviados: quem define
 * é o servidor. A API repete as validações e grava a demanda e o histórico no banco.
 * Depois de gravar, a tela abre a demanda criada.
 */
async function criarDemanda() {
  const resposta = await chamarApi('POST', '/demandas', {
    titulo: document.getElementById('titulo').value.trim(),
    descricao: document.getElementById('descricao').value.trim(),
    tipo: document.getElementById('tipo').value,
    prioridade: document.getElementById('prioridade').value,
    projetoId: Number(document.getElementById('projeto').value),
    responsavelId: responsavelEscolhido(),
    prazo: document.getElementById('prazo').value || null,
    usuarioId: usuario.id
  });

  // Erro devolvido pela API (dados inválidos, sem permissão, feriado...) vai para a tela.
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', resposta.erro);
    return;
  }

  // A API avisa quando não conseguiu conferir o prazo na API de feriados.
  if (resposta.dados.aviso) {
    alert(resposta.dados.aviso);
  }

  window.location.href = 'demanda.html?id=' + resposta.dados.demanda.id;
}

/*
 * Atualiza a demanda existente com PATCH /demandas/:id.
 * A tela envia os campos que o perfil pode alterar; o servidor compara com o
 * que está gravado, confere permissão e fluxo de status, grava só o que mudou
 * e registra uma linha de histórico para cada campo alterado.
 */
async function atualizarDemanda() {
  const alteracoes = {};

  if (podeEditarDemanda(usuario, demandaAtual)) {
    alteracoes.titulo = document.getElementById('titulo').value.trim();
    alteracoes.descricao = document.getElementById('descricao').value.trim();
    alteracoes.tipo = document.getElementById('tipo').value;
    alteracoes.prioridade = document.getElementById('prioridade').value;
    alteracoes.prazo = document.getElementById('prazo').value || null;
    alteracoes.responsavelId = responsavelEscolhido();
  }

  const novoStatus = document.getElementById('status').value;
  if (novoStatus !== demandaAtual.status) {
    alteracoes.status = novoStatus;
  }

  if (Object.keys(alteracoes).length === 0) {
    mostrarAviso('aviso-info', 'Nenhuma alteração foi identificada.');
    return;
  }

  await enviarAlteracoes(alteracoes, 'Demanda atualizada no banco de dados.');
}

/*
 * Cancelar a demanda.
 * Não existe exclusão física de registros: o cancelamento apenas grava o status
 * Cancelada, preservando todo o histórico das atividades. Como não tem volta,
 * a tela pede confirmação antes.
 */
async function aoCancelarDemanda() {
  esconderAvisos();

  if (!podeCancelar(usuario, demandaAtual)) {
    mostrarAviso('aviso-erro', 'Seu perfil não pode cancelar demandas.');
    return;
  }

  if (!confirm('Cancelar a demanda #' + demandaAtual.id + '? Essa ação não pode ser desfeita.')) {
    return;
  }

  const botao = document.getElementById('botao-cancelar-demanda');
  botao.disabled = true;
  try {
    await enviarAlteracoes({ status: STATUS.CANCELADA },
      'Demanda cancelada. O registro e o histórico foram preservados.');
  } finally {
    botao.disabled = false;
  }
}

/* Envia as alterações para a API, recarrega a demanda do banco e redesenha a tela. */
async function enviarAlteracoes(alteracoes, mensagemDeSucesso) {
  alteracoes.usuarioId = usuario.id;

  const resposta = await chamarApi('PATCH', '/demandas/' + demandaAtual.id, alteracoes);
  if (!resposta.ok) {
    mostrarAviso('aviso-erro', resposta.erro);
    return;
  }

  // Quando nada mudou, a API devolve a demanda com a mesma data de atualização.
  if (resposta.dados.demanda.dataAtualizacao === demandaAtual.dataAtualizacao) {
    mostrarAviso('aviso-info', 'Nenhuma alteração foi identificada.');
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

/* Reaplica dados e permissões após uma gravação, sem recarregar a página. */
function redesenharTela() {
  if (!podeEditarDemanda(usuario, demandaAtual)) {
    definirTitulo('Detalhes da Demanda', 'Consulte os dados, os comentários e o histórico da demanda');
  }
  preencherFormulario();
  montarStatusDisponiveis();
  aplicarPermissoes();
  renderizarHistorico();
}


/* ==========================================================================
   Comentários
   ========================================================================== */

async function aoComentar() {
  esconderAvisos();
  limparErros();

  if (!podeComentar(usuario, demandaAtual)) {
    mostrarAviso('aviso-erro', 'Você não pode comentar nesta demanda.');
    return;
  }

  const campo = document.getElementById('novo-comentario');
  const texto = campo.value.trim();

  if (texto.length < 3) {
    marcarErro('comentario', 'Escreva um comentário com pelo menos 3 caracteres.');
    return;
  }

  // Desabilitado durante o envio, para um duplo clique não gravar o comentário duas vezes.
  const botao = document.getElementById('botao-comentar');
  botao.disabled = true;
  try {
    // O servidor grava o comentário com o usuário e a data/hora do registro.
    const resposta = await chamarApi('POST', '/demandas/' + demandaAtual.id + '/comentarios', {
      usuarioId: usuario.id,
      texto: texto
    });
    if (!resposta.ok) {
      mostrarAviso('aviso-erro', resposta.erro);
      return;
    }

    demandaAtual.comentarios.push(resposta.dados.comentario);

    campo.value = '';
    renderizarComentarios();
    mostrarAviso('aviso-sucesso', 'Comentário gravado no banco de dados.');
  } finally {
    botao.disabled = false;
  }
}

function renderizarComentarios() {
  const lista = document.getElementById('lista-comentarios');
  lista.innerHTML = '';

  if (!demandaAtual.comentarios || demandaAtual.comentarios.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'lista-vazia';
    vazio.textContent = 'Nenhum comentário registrado até o momento.';
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
    // textContent evita que o conteúdo digitado seja interpretado como HTML.
    texto.textContent = comentario.texto;

    item.appendChild(topo);
    item.appendChild(texto);
    lista.appendChild(item);
  });
}


/* ==========================================================================
   Histórico de alterações
   ========================================================================== */

function renderizarHistorico() {
  const lista = document.getElementById('lista-historico');
  lista.innerHTML = '';

  if (!demandaAtual.historico || demandaAtual.historico.length === 0) {
    const vazio = document.createElement('li');
    vazio.className = 'lista-vazia';
    vazio.textContent = 'Nenhum registro de alteração.';
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
   Funções auxiliares de tela
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
