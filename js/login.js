/**
 * Autor: Felipe Oliveira dos Santos
 *
 * Validação da tela de login.
 */

const formulario = document.querySelector("#formLogin");
const campoUser = document.querySelector("#user");
const campoSenha = document.querySelector("#senha");
const erroUser = document.querySelector("#erroUser");
const erroSenha = document.querySelector("#erroSenha");

const camposComErro = [
    campoUser,
    campoSenha
];

const mensagensDeErro = [
    erroUser,
    erroSenha
];

// exibe a mensagem de erro e destaca o campo
function mostrarErro(campo, elementoErro, mensagem) {
    campo.classList.add("erro-campo");
    elementoErro.innerText = mensagem;
}

// remove os erros exibidos anteriormente
function limparErros() {
    camposComErro.forEach(function (campo) {
        campo.classList.remove("erro-campo");
    });

    mensagensDeErro.forEach(function (elementoErro) {
        elementoErro.innerText = "";
    });
}

formulario.addEventListener("submit", function (event) {
    event.preventDefault();

    limparErros();

    const user = campoUser.value.trim();
    const senha = campoSenha.value;

    let formValido = true;

    // validação do nome de usuário
    if (user === "") {
        mostrarErro(campoUser, erroUser, "O nome de usuário é obrigatório!");
        formValido = false;
    } else if (user.length < 3) {
        mostrarErro(campoUser, erroUser, "O nome de usuário deve possuir pelo menos 3 caracteres!");
        formValido = false;
    }

    // validação da senha
    if (senha === "") {
        mostrarErro(campoSenha, erroSenha, "A senha é obrigatória!");
        formValido = false;
    } else if (senha.length < 8) {
        mostrarErro(campoSenha, erroSenha, "A senha deve possuir pelo menos 8 caracteres!");
        formValido = false;
    }

    // redireciona para a página inicial quando os dados forem válidos
    if (formValido) {
        window.location.href = "../index.html";
    }
});