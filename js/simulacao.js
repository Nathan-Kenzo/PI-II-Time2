/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Monta a barra temporaria de simulacao de perfil.
 *
 * Enquanto a tela de login nao define o usuario da sessao, esta barra permite
 * trocar o usuario logado para demonstrar as regras de permissao nas telas de
 * dashboard, listagem e demanda.
 *
 * Para usar, basta a pagina ter <div id="barra-simulacao"></div> e carregar
 * este arquivo depois de js/dados.js.
 *
 * REMOVER junto com css/simulacao.css quando a autenticacao real estiver pronta.
 */

document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('barra-simulacao');
  if (!container) {
    return;
  }

  const atual = usuarioLogado();

  container.className = 'barra-simulacao';

  const rotulo = document.createElement('label');
  rotulo.setAttribute('for', 'seletor-usuario');
  rotulo.textContent = 'Simulacao de acesso — usuario logado:';

  const seletor = document.createElement('select');
  seletor.id = 'seletor-usuario';

  listarUsuarios().forEach(function (item) {
    const opcao = document.createElement('option');
    opcao.value = item.id;
    opcao.textContent = item.nome;
    seletor.appendChild(opcao);
  });
  seletor.value = atual.id;

  // Ao trocar de usuario a tela e recarregada para reaplicar todas as permissoes.
  seletor.addEventListener('change', function () {
    definirUsuarioLogado(seletor.value);
    window.location.reload();
  });

  const perfil = document.createElement('span');
  perfil.id = 'perfil-usuario';
  perfil.textContent = '(' + atual.perfil + ' - ' + descreverVinculo(atual) + ')';

  const aviso = document.createElement('span');
  aviso.className = 'aviso-simulacao';
  aviso.textContent = 'Area temporaria: sera substituida pela autenticacao real.';

  container.appendChild(rotulo);
  container.appendChild(seletor);
  container.appendChild(perfil);
  container.appendChild(aviso);
});

/* Texto com os projetos que o usuario enxerga, exibido ao lado do perfil. */
function descreverVinculo(usuario) {
  if (usuario.perfil === PERFIS.ADMIN) {
    return 'todos os projetos';
  }

  const nomes = (usuario.projetos || []).map(function (id) {
    const projeto = buscarProjeto(id);
    return projeto ? projeto.nome : '';
  }).filter(Boolean);

  return nomes.length > 0 ? nomes.join(', ') : 'nenhum projeto';
}
