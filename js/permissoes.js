/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descrição: Regras de permissão por perfil de acesso e regras do ciclo de vida
 *            da demanda, conforme os itens 2.1 e 2.2.4 do documento de visão.
 *
 * Este arquivo concentra as regras de negócio de acesso para que as telas apenas
 * perguntem "o usuário pode fazer isso?" em vez de repetir a regra em cada lugar.
 * As mesmas regras são aplicadas novamente no backend, já que o bloqueio feito
 * somente no navegador não garante segurança.
 */

/* ==========================================================================
   Ciclo de vida da demanda
   ========================================================================== */

/*
 * Transições permitidas a partir de cada status.
 * Regras do documento de visão:
 *  - toda demanda nasce Aberta;
 *  - não é permitido concluir direto de Em andamento, deve passar por Em revisão;
 *  - não é permitido voltar de Em andamento para Aberta;
 *  - Em revisão pode voltar para Em andamento quando a conferência reprovar;
 *  - o cancelamento pode ocorrer a qualquer momento, desde que não esteja Concluída;
 *  - Concluída e Cancelada são status finais.
 */
const TRANSICOES = {
  'Aberta':       ['Em andamento', 'Cancelada'],
  'Em andamento': ['Em revisão', 'Cancelada'],
  'Em revisão':   ['Em andamento', 'Concluída', 'Cancelada'],
  'Concluída':    [],
  'Cancelada':    []
};

/*
 * Transições que o Membro da Equipe pode realizar, e apenas nas demandas
 * atribuídas a ele. Todas as demais cabem ao Líder de Projeto ou ao Administrador.
 */
const TRANSICOES_DO_MEMBRO = {
  'Aberta': ['Em andamento'],
  'Em andamento': ['Em revisão']
};

/* Indica se a mudança de um status para outro respeita o fluxo da demanda. */
function transicaoValida(statusAtual, statusNovo) {
  if (statusAtual === statusNovo) {
    return true; // manter o status atual é sempre aceito
  }
  const permitidos = TRANSICOES[statusAtual] || [];
  return permitidos.indexOf(statusNovo) >= 0;
}


/* ==========================================================================
   Consultas auxiliares de vínculo
   ========================================================================== */

/* O usuário está vinculado ao projeto informado? O Administrador vê todos. */
function vinculadoAoProjeto(usuario, projetoId) {
  if (!usuario) {
    return false;
  }
  if (usuario.perfil === PERFIS.ADMIN) {
    return true;
  }
  return (usuario.projetos || []).indexOf(Number(projetoId)) >= 0;
}

/* O usuário é o responsável pela demanda? A demanda tem no máximo um responsável. */
function ehResponsavel(usuario, demanda) {
  if (!usuario || !demanda) {
    return false;
  }
  return demanda.responsavelId === usuario.id;
}

/* Demandas concluídas ou canceladas não aceitam mais alterações. */
function demandaEncerrada(demanda) {
  return !!demanda && (demanda.status === STATUS.CONCLUIDA || demanda.status === STATUS.CANCELADA);
}


/* ==========================================================================
   Permissões por ação
   Cada função devolve true quando a ação é permitida ao usuário informado.
   ========================================================================== */

/* Visualizar a demanda: o Administrador vê todas; os demais, apenas as dos seus projetos. */
function podeVisualizar(usuario, demanda) {
  if (!usuario || !demanda) {
    return false;
  }
  return vinculadoAoProjeto(usuario, demanda.projetoId);
}

/* Criar demanda: permitido ao Administrador e ao Líder de Projeto. */
function podeCriarDemanda(usuario) {
  if (!usuario) {
    return false;
  }
  return usuario.perfil === PERFIS.ADMIN || usuario.perfil === PERFIS.LIDER;
}

/*
 * Editar os dados da demanda (título, descrição, tipo, prazo).
 * O Administrador edita qualquer demanda; o Líder apenas as dos projetos aos
 * quais está vinculado; o Membro da Equipe não edita demandas.
 * Demandas encerradas não podem mais ser editadas.
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

/* Atribuir ou alterar o responsável: Administrador e Líder do projeto. */
function podeAlterarResponsavel(usuario, demanda) {
  return podeEditarDemanda(usuario, demanda);
}

/* Alterar a prioridade: Administrador e Líder do projeto. */
function podeAlterarPrioridade(usuario, demanda) {
  return podeEditarDemanda(usuario, demanda);
}

/* Registrar comentários: permitido a todos os perfis que enxergam a demanda. */
function podeComentar(usuario, demanda) {
  return podeVisualizar(usuario, demanda);
}

/*
 * Alterar o status para um valor específico.
 * Verifica, nesta ordem: vínculo com o projeto, validade da transição no fluxo
 * e, para o Membro da Equipe, se a demanda é dele e se a transição está na
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

  // Membro da Equipe: apenas nas demandas atribuídas a ele e nas duas transições previstas.
  if (!ehResponsavel(usuario, demanda)) {
    return false;
  }
  const permitidos = TRANSICOES_DO_MEMBRO[demanda.status] || [];
  return permitidos.indexOf(statusNovo) >= 0;
}

/* Lista dos status que o usuário realmente consegue escolher para esta demanda. */
function statusDisponiveis(usuario, demanda) {
  if (!demanda) {
    return [];
  }
  const candidatos = TRANSICOES[demanda.status] || [];
  return candidatos.filter(function (statusNovo) {
    return podeAlterarStatus(usuario, demanda, statusNovo);
  });
}

/*
 * Cancelar a demanda. Não existe exclusão física no sistema: cancelar significa
 * gravar o status Cancelada, preservando o histórico das atividades.
 */
function podeCancelar(usuario, demanda) {
  return podeAlterarStatus(usuario, demanda, STATUS.CANCELADA);
}

/*
 * Mensagem exibida ao usuário explicando por que a tela está somente leitura.
 * Retorna string vazia quando o usuário pode editar normalmente.
 */
function motivoSomenteLeitura(usuario, demanda) {
  if (!demanda) {
    return '';
  }
  if (!podeVisualizar(usuario, demanda)) {
    return 'Você não está vinculado ao projeto desta demanda, portanto não pode visualizá-la.';
  }
  if (demanda.status === STATUS.CONCLUIDA) {
    return 'Esta demanda já foi concluída e não aceita mais alterações. O histórico permanece disponível para consulta.';
  }
  if (demanda.status === STATUS.CANCELADA) {
    return 'Esta demanda foi cancelada. O registro e o histórico são preservados, mas não podem mais ser alterados.';
  }
  if (!podeEditarDemanda(usuario, demanda)) {
    if (statusDisponiveis(usuario, demanda).length > 0) {
      return 'Seu perfil não permite editar os dados desta demanda. Você pode atualizar o status e registrar comentários.';
    }
    return 'Seu perfil não permite editar esta demanda. Você pode registrar comentários e consultar o histórico.';
  }
  return '';
}
