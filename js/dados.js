/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Camada temporaria de dados do DemandaTrack.
 *
 * IMPORTANTE: enquanto a API (Node.js + TypeScript + Express) e o banco MySQL
 * nao estiverem prontos, esta camada guarda projetos, usuarios e demandas no
 * localStorage do navegador. Quando o backend existir, basta trocar o corpo das
 * funcoes deste arquivo por chamadas fetch() a API, mantendo a mesma assinatura,
 * que nenhuma outra tela precisara ser alterada.
 */

/* ==========================================================================
   Listas fixas exigidas pelo documento de visao
   ========================================================================== */

/* Tipos obrigatorios da demanda (item 2.2.1 do documento de visao) */
const TIPOS = ['Tarefa', 'Defeito', 'Melhoria', 'Documentacao'];

/*
 * Opcao extra da equipe: alem dos quatro tipos obrigatorios, a demanda pode
 * receber um tipo escrito pelo proprio usuario. Esta constante e apenas o rotulo
 * exibido na lista; o que fica gravado na demanda e o texto digitado.
 */
const TIPO_PERSONALIZADO = 'Personalizado...';

/* Indica se o tipo gravado e um dos quatro obrigatorios ou um texto livre. */
function tipoEhPersonalizado(tipo) {
  return !!tipo && TIPOS.indexOf(tipo) < 0;
}

/* Prioridades obrigatorias (item 2.2.2) */
const PRIORIDADES = ['Critica', 'Alta', 'Media', 'Baixa'];

/* Status obrigatorios (item 2.2.3) */
const STATUS = {
  ABERTA: 'Aberta',
  ANDAMENTO: 'Em andamento',
  REVISAO: 'Em revisao',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada'
};

/* Perfis de acesso obrigatorios (item 2.1) */
const PERFIS = {
  ADMIN: 'Administrador',
  LIDER: 'Lider de Projeto',
  MEMBRO: 'Membro da Equipe'
};


/* ==========================================================================
   Dados iniciais
   O documento de visao permite que projetos e usuarios sejam previamente
   cadastrados no banco, sem telas proprias de manutencao (item 2.1).
   ========================================================================== */

const PROJETOS_INICIAIS = [
  { id: 1, nome: 'DemandaTrack' },
  { id: 2, nome: 'Portal Academico' },
  { id: 3, nome: 'App de Biblioteca' }
];

/*
 * Cada usuario possui um perfil e a lista de projetos aos quais esta vinculado.
 * O Administrador enxerga todos os projetos, por isso sua lista fica vazia.
 */
const USUARIOS_INICIAIS = [
  { id: 1, nome: 'Nathan Kenzo Puzipe',         perfil: PERFIS.ADMIN,  projetos: [] },
  { id: 2, nome: 'Pedro Tiezo Sales Shimizu',   perfil: PERFIS.LIDER,  projetos: [1] },
  { id: 3, nome: 'Henrique Aguiar de S. Pella', perfil: PERFIS.LIDER,  projetos: [2, 3] },
  { id: 4, nome: 'Felipe Oliveira Barbosa',     perfil: PERFIS.MEMBRO, projetos: [1] },
  { id: 5, nome: 'Felipe Oliveira dos Santos',  perfil: PERFIS.MEMBRO, projetos: [1, 2] }
];

const DEMANDAS_INICIAIS = [
  {
    id: 1,
    titulo: 'Corrigir erro no login',
    descricao: 'O formulario de login aceita a submissao com os campos em branco.',
    tipo: 'Defeito',
    prioridade: 'Critica',
    status: STATUS.ABERTA,
    projetoId: 1,
    responsaveisIds: [4],
    dataCriacao: '2026-08-20T09:00:00',
    dataAtualizacao: '2026-08-20T09:00:00',
    prazo: '2026-09-30',
    comentarios: [
      {
        id: 1,
        usuarioId: 2,
        texto: 'Reproduzido no Chrome e no Firefox. Falta a validacao no submit.',
        dataHora: '2026-08-21T14:32:00'
      }
    ],
    historico: [
      { id: 1, usuarioId: 2, descricao: 'criou a demanda.', dataHora: '2026-08-20T09:00:00' }
    ]
  },
  {
    id: 2,
    titulo: 'Criar tela de dashboard',
    descricao: 'Montar a tela inicial com os indicadores resumidos das demandas.',
    tipo: 'Tarefa',
    prioridade: 'Alta',
    status: STATUS.ANDAMENTO,
    projetoId: 1,
    responsaveisIds: [5, 4],
    dataCriacao: '2026-08-21T10:15:00',
    dataAtualizacao: '2026-08-25T16:40:00',
    prazo: '2026-09-18',
    comentarios: [],
    historico: [
      { id: 1, usuarioId: 2, descricao: 'criou a demanda.', dataHora: '2026-08-21T10:15:00' },
      { id: 2, usuarioId: 5, descricao: 'alterou o status da demanda de Aberta para Em andamento.', dataHora: '2026-08-25T16:40:00' }
    ]
  },
  {
    id: 3,
    titulo: 'Documentar rotas da API',
    descricao: 'Descrever no README todas as rotas REST previstas para as demandas.',
    tipo: 'Documentacao',
    prioridade: 'Media',
    status: STATUS.REVISAO,
    projetoId: 1,
    responsaveisIds: [],
    dataCriacao: '2026-08-22T08:05:00',
    dataAtualizacao: '2026-08-27T11:20:00',
    prazo: '2026-09-25',
    comentarios: [],
    historico: [
      { id: 1, usuarioId: 1, descricao: 'criou a demanda.', dataHora: '2026-08-22T08:05:00' }
    ]
  }
];


/* ==========================================================================
   Persistencia local (substituir por chamadas a API futuramente)
   ========================================================================== */

const CHAVE_DEMANDAS = 'demandatrack.demandas';
const CHAVE_USUARIO_LOGADO = 'demandatrack.usuarioLogado';

/* Le a lista de demandas do localStorage; na primeira execucao usa a carga inicial. */
function lerDemandas() {
  try {
    const bruto = localStorage.getItem(CHAVE_DEMANDAS);
    if (bruto) {
      return JSON.parse(bruto).map(migrarDemanda);
    }
  } catch (erro) {
    // Se o conteudo estiver corrompido, recomeca da carga inicial em vez de quebrar a tela.
    console.warn('Nao foi possivel ler as demandas salvas:', erro);
  }

  gravarDemandas(DEMANDAS_INICIAIS);
  return JSON.parse(JSON.stringify(DEMANDAS_INICIAIS));
}

/*
 * Ajusta demandas gravadas em um formato antigo.
 * A demanda passou a aceitar mais de um responsavel: o campo responsavelId
 * (um unico id) foi substituido por responsaveisIds (uma lista de ids).
 */
function migrarDemanda(demanda) {
  if (!Array.isArray(demanda.responsaveisIds)) {
    demanda.responsaveisIds = demanda.responsavelId ? [demanda.responsavelId] : [];
  }
  delete demanda.responsavelId;
  return demanda;
}

/* Grava a lista completa de demandas. */
function gravarDemandas(demandas) {
  try {
    localStorage.setItem(CHAVE_DEMANDAS, JSON.stringify(demandas));
  } catch (erro) {
    console.warn('Nao foi possivel salvar as demandas:', erro);
  }
}

/* Busca uma unica demanda pelo seu identificador. Retorna null se nao existir. */
function buscarDemanda(id) {
  const demandas = lerDemandas();
  return demandas.find(function (demanda) { return demanda.id === Number(id); }) || null;
}

/* Insere ou atualiza uma demanda na lista, conforme ela ja possua id ou nao. */
function salvarDemanda(demanda) {
  const demandas = lerDemandas();
  const posicao = demandas.findIndex(function (item) { return item.id === demanda.id; });

  if (posicao >= 0) {
    demandas[posicao] = demanda;
  } else {
    demandas.push(demanda);
  }

  gravarDemandas(demandas);
  return demanda;
}

/* Gera o proximo id disponivel para uma nova demanda. */
function proximoIdDemanda() {
  const demandas = lerDemandas();
  if (demandas.length === 0) {
    return 1;
  }
  const maiorId = demandas.reduce(function (maior, demanda) {
    return demanda.id > maior ? demanda.id : maior;
  }, 0);
  return maiorId + 1;
}

/* Gera o proximo id de um item de uma lista interna (comentarios ou historico). */
function proximoIdLista(lista) {
  if (!lista || lista.length === 0) {
    return 1;
  }
  const maiorId = lista.reduce(function (maior, item) {
    return item.id > maior ? item.id : maior;
  }, 0);
  return maiorId + 1;
}


/* ==========================================================================
   Usuarios e projetos
   ========================================================================== */

function listarUsuarios() {
  return USUARIOS_INICIAIS;
}

function listarProjetos() {
  return PROJETOS_INICIAIS;
}

function buscarUsuario(id) {
  return USUARIOS_INICIAIS.find(function (usuario) { return usuario.id === Number(id); }) || null;
}

function buscarProjeto(id) {
  return PROJETOS_INICIAIS.find(function (projeto) { return projeto.id === Number(id); }) || null;
}

/* Nome do responsavel para exibicao; demandas sem responsavel mostram um traco. */
function nomeUsuario(id) {
  const usuario = buscarUsuario(id);
  return usuario ? usuario.nome : '-';
}

/*
 * Nomes de uma lista de responsaveis, separados por virgula.
 * Demandas ainda sem responsavel definido mostram um traco.
 */
function nomesUsuarios(ids) {
  if (!ids || ids.length === 0) {
    return '-';
  }
  return ids.map(nomeUsuario).join(', ');
}

/*
 * Usuario autenticado no momento.
 * Enquanto a tela de login nao esta integrada, o usuario e escolhido na barra
 * de simulacao de perfil e guardado no localStorage.
 */
function usuarioLogado() {
  const id = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  return buscarUsuario(id) || USUARIOS_INICIAIS[0];
}

function definirUsuarioLogado(id) {
  localStorage.setItem(CHAVE_USUARIO_LOGADO, String(id));
}
