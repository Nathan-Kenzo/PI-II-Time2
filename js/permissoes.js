/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Regras de permissao por perfil de acesso e regras do ciclo de vida
 *            da demanda, conforme os itens 2.1 e 2.2.4 do documento de visao.
 *
 * Este arquivo concentra as regras de negocio de acesso para que as telas apenas
 * perguntem "o usuario pode fazer isso?" em vez de repetir a regra em cada lugar.
 * As mesmas regras deverao ser aplicadas novamente no backend, ja que o bloqueio
 * feito somente no navegador nao garante seguranca.
 */

/* ==========================================================================
   Ciclo de vida da demanda
   ========================================================================== */

/*
 * Transicoes permitidas a partir de cada status.
 * Regras do documento de visao:
 *  - toda demanda nasce Aberta;
 *  - nao e permitido concluir direto de Em andamento, deve passar por Em revisao;
 *  - nao e permitido voltar de Em andamento para Aberta;
 *  - Em revisao pode voltar para Em andamento quando a conferencia reprovar;
 *  - o cancelamento pode ocorrer a qualquer momento, desde que nao esteja Concluida;
 *  - Concluida e Cancelada sao status finais.
 */
const TRANSICOES = {
  'Aberta':       ['Em andamento', 'Cancelada'],
  'Em andamento': ['Em revisao', 'Cancelada'],
  'Em revisao':   ['Em andamento', 'Concluida', 'Cancelada'],
  'Concluida':    [],
  'Cancelada':    []
};

/*
 * Transicoes que o Membro da Equipe pode realizar, e apenas nas demandas
 * atribuidas a ele. Todas as demais cabem ao Lider de Projeto ou ao Administrador.
 */
const TRANSICOES_DO_MEMBRO = {
  'Aberta': ['Em andamento'],
  'Em andamento': ['Em revisao']
};

/* Indica se a mudanca de um status para outro respeita o fluxo da demanda. */
function transicaoValida(statusAtual, statusNovo) {
  if (statusAtual === statusNovo) {
    return true; // manter o status atual e sempre aceito
  }
  const permitidos = TRANSICOES[statusAtual] || [];
  return permitidos.indexOf(statusNovo) >= 0;
}


/* ==========================================================================
   Consultas auxiliares de vinculo
   ========================================================================== */

/* O usuario esta vinculado ao projeto informado? O Administrador ve todos. */
function vinculadoAoProjeto(usuario, projetoId) {
  if (!usuario) {
    return false;
  }
  if (usuario.perfil === PERFIS.ADMIN) {
    return true;
  }
  return (usuario.projetos || []).indexOf(Number(projetoId)) >= 0;
}

/*
 * O usuario esta entre os responsaveis pela demanda?
 * A demanda aceita mais de um responsavel, entao a verificacao e feita na lista.
 */
function ehResponsavel(usuario, demanda) {
  if (!usuario || !demanda) {
    return false;
  }
  return (demanda.responsaveisIds || []).indexOf(usuario.id) >= 0;
}

/* Demandas concluidas ou canceladas nao aceitam mais alteracoes. */
function demandaEncerrada(demanda) {
  return !!demanda && (demanda.status === STATUS.CONCLUIDA || demanda.status === STATUS.CANCELADA);
}


/* ==========================================================================
   Permissoes por acao
   Cada funcao devolve true quando a acao e permitida ao usuario informado.
   ========================================================================== */

/* Visualizar a demanda: o Administrador ve todas; os demais, apenas as dos seus projetos. */
function podeVisualizar(usuario, demanda) {
  if (!usuario || !demanda) {
    return false;
  }
  return vinculadoAoProjeto(usuario, demanda.projetoId);
}

/*
 * Todas as demandas que o usuario pode enxergar.
 * Usada pelo dashboard e pela listagem: o Administrador ve tudo, os demais
 * perfis veem apenas as demandas dos projetos aos quais estao vinculados.
 */
function demandasVisiveis(usuario) {
  return lerDemandas().filter(function (demanda) {
    return podeVisualizar(usuario, demanda);
  });
}

/* Criar demanda: permitido ao Administrador e ao Lider de Projeto. */
function podeCriarDemanda(usuario) {
  if (!usuario) {
    return false;
  }
  return usuario.perfil === PERFIS.ADMIN || usuario.perfil === PERFIS.LIDER;
}

/*
 * Editar os dados da demanda (titulo, descricao, tipo, prazo).
 * O Administrador edita qualquer demanda; o Lider apenas as dos projetos aos
 * quais esta vinculado; o Membro da Equipe nao edita demandas.
 * Demandas encerradas nao podem mais ser editadas.
 */
function podeEditarDemanda(usuario, demanda) {
  if (!usuario || !demanda || demandaEncerrada(demanda)) {
    return false;
  }
  if (usuario.perfil === PERFIS.ADMIN) {
    return true;
  }
  if (usuario.perfil === PERFIS.LIDER) {
    return vinculadoAoProjeto(usuario, demanda.projetoId);
  }
  return false;
}

/* Atribuir ou alterar o responsavel: Administrador e Lider do projeto. */
function podeAlterarResponsavel(usuario, demanda) {
  return podeEditarDemanda(usuario, demanda);
}

/* Alterar a prioridade: Administrador e Lider do projeto. */
function podeAlterarPrioridade(usuario, demanda) {
  return podeEditarDemanda(usuario, demanda);
}

/* Registrar comentarios: permitido a todos os perfis que enxergam a demanda. */
function podeComentar(usuario, demanda) {
  return podeVisualizar(usuario, demanda);
}

/* Visualizar o historico de alteracoes: permitido a todos os perfis. */
function podeVerHistorico(usuario, demanda) {
  return podeVisualizar(usuario, demanda);
}

/*
 * Alterar o status para um valor especifico.
 * Verifica, nesta ordem: vinculo com o projeto, validade da transicao no fluxo
 * e, para o Membro da Equipe, se a demanda e dele e se a transicao esta na
 * lista restrita permitida ao perfil.
 */
function podeAlterarStatus(usuario, demanda, statusNovo) {
  if (!usuario || !demanda) {
    return false;
  }
  if (!vinculadoAoProjeto(usuario, demanda.projetoId)) {
    return false;
  }
  if (demandaEncerrada(demanda)) {
    return false;
  }
  if (!transicaoValida(demanda.status, statusNovo)) {
    return false;
  }

  if (usuario.perfil === PERFIS.ADMIN || usuario.perfil === PERFIS.LIDER) {
    return true;
  }

  // Membro da Equipe: apenas nas demandas atribuidas a ele e nas duas transicoes previstas.
  if (!ehResponsavel(usuario, demanda)) {
    return false;
  }
  const permitidos = TRANSICOES_DO_MEMBRO[demanda.status] || [];
  return permitidos.indexOf(statusNovo) >= 0;
}

/* Lista dos status que o usuario realmente consegue escolher para esta demanda. */
function statusDisponiveis(usuario, demanda) {
  if (!demanda) {
    return [];
  }
  const candidatos = TRANSICOES[demanda.status] || [];
  return candidatos.filter(function (statusNovo) {
    return podeAlterarStatus(usuario, demanda, statusNovo);
  });
}

/* Concluir a demanda: caso particular de mudanca de status para Concluida. */
function podeConcluir(usuario, demanda) {
  return podeAlterarStatus(usuario, demanda, STATUS.CONCLUIDA);
}

/*
 * Cancelar a demanda. Nao existe exclusao fisica no sistema: cancelar significa
 * gravar o status Cancelada, preservando o historico das atividades.
 */
function podeCancelar(usuario, demanda) {
  return podeAlterarStatus(usuario, demanda, STATUS.CANCELADA);
}

/*
 * Projetos que o usuario pode escolher ao criar uma demanda.
 * O Administrador escolhe qualquer projeto; o Lider, apenas os seus.
 */
function projetosDisponiveis(usuario) {
  const projetos = listarProjetos();
  if (!usuario || usuario.perfil === PERFIS.ADMIN) {
    return projetos;
  }
  return projetos.filter(function (projeto) {
    return vinculadoAoProjeto(usuario, projeto.id);
  });
}

/*
 * Mensagem exibida ao usuario explicando por que a tela esta somente leitura.
 * Retorna string vazia quando o usuario pode editar normalmente.
 */
function motivoSomenteLeitura(usuario, demanda) {
  if (!demanda) {
    return '';
  }
  if (!podeVisualizar(usuario, demanda)) {
    return 'Voce nao esta vinculado ao projeto desta demanda, portanto nao pode visualiza-la.';
  }
  if (demanda.status === STATUS.CONCLUIDA) {
    return 'Esta demanda ja foi concluida e nao aceita mais alteracoes. O historico permanece disponivel para consulta.';
  }
  if (demanda.status === STATUS.CANCELADA) {
    return 'Esta demanda foi cancelada. O registro e o historico sao preservados, mas nao podem mais ser alterados.';
  }
  if (!podeEditarDemanda(usuario, demanda)) {
    if (statusDisponiveis(usuario, demanda).length > 0) {
      return 'Seu perfil nao permite editar os dados desta demanda. Voce pode atualizar o status e registrar comentarios.';
    }
    return 'Seu perfil nao permite editar esta demanda. Voce pode registrar comentarios e consultar o historico.';
  }
  return '';
}
