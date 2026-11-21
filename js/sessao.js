/**
 * Autor: Felipe Oliveira dos Santos
 * Descrição: Barra com o usuário logado e menu comum das telas internas
 *            (dashboard, listagem e demanda).
 *
 * O usuário vem de usuarioLogado() (js/dados.js), que a tela de login gravou.
 * Para mostrar a barra, basta a página ter <div id="barra-usuario"></div>.
 * O link "Sair" (id="link-sair") apaga o login antes de ir para login.html, e o
 * link "Nova Demanda" do menu (id="menu-nova-demanda") some para o Membro da Equipe.
 */

document.addEventListener("DOMContentLoaded", function () {

  const usuario = usuarioLogado();

  if (!usuario) {
    return;
  }

  // sair: apaga o usuário guardado; o próprio link leva para login.html
  const linkSair = document.getElementById("link-sair");
  if (linkSair) {
    linkSair.addEventListener("click", function () {
      localStorage.removeItem("usuario");
    });
  }

  // o Membro da Equipe não cria demandas
  const menuNovaDemanda = document.getElementById("menu-nova-demanda");
  if (menuNovaDemanda && usuario.perfil === PERFIS.MEMBRO) {
    menuNovaDemanda.hidden = true;
  }

  const container = document.getElementById("barra-usuario");

  if (!container) {
    return;
  }

  container.className = "barra-usuario";

  const rotulo = document.createElement("span");
  rotulo.textContent = "Usuário logado:";

  const nome = document.createElement("strong");
  nome.textContent = " " + usuario.nome + " ";

  const perfil = document.createElement("span");
  perfil.textContent = "(" + usuario.perfil + ")";

  container.appendChild(rotulo);
  container.appendChild(nome);
  container.appendChild(perfil);

});
