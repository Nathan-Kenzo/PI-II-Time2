/**
 * Autor: Felipe Oliveira dos Santos
 * Descricao: Barra para vizualizar o usuario logado.
 *
 * A tela de login passou a definir o usuario logado e esta enviando essas informacoes para vizualizar no sistema.
 *
 * Para usar, basta a pagina ter <div id="barra-simulacao"></div>
 *
 */

document.addEventListener("DOMContentLoaded", function () {

  const container =
    document.getElementById("barra-simulacao");

  if (!container) {
    return;
  }

  const usuario = JSON.parse(
    localStorage.getItem("usuario")
  );

  if (!usuario) {
    return;
  }

  container.className =
    "barra-simulacao";

  const rotulo =
    document.createElement("span");

  rotulo.textContent =
    "Usuário logado:";

  const nome =
    document.createElement("strong");

  nome.textContent =
    " " + usuario.nome + " ";

  const perfil =
    document.createElement("span");

  perfil.textContent =
    "(" + usuario.perfil + ")";

  container.appendChild(rotulo);
  container.appendChild(nome);
  container.appendChild(perfil);

});