/**
 * Autor: Felipe Oliveira dos Santos
 *
 * Validação da tela de cadastro.
 */

const formulario = document.querySelector("#formCadastro");

const campoNome = document.querySelector("#nome");
const campoUser = document.querySelector("#user");
const campoEmail = document.querySelector("#email");
const campoSenha = document.querySelector("#senha");
const campoConfirmar = document.querySelector("#confirmar");

const erroNome = document.querySelector("#erroNome");
const erroUser = document.querySelector("#erroUser");
const erroEmail = document.querySelector("#erroEmail");
const erroSenha = document.querySelector("#erroSenha");
const erroConfirmar = document.querySelector("#erroConfirmar");

const camposComErro = [
    campoNome,
    campoUser,
    campoEmail,
    campoSenha,
    campoConfirmar
];

const mensagensDeErro = [
    erroNome,
    erroUser,
    erroEmail,
    erroSenha,
    erroConfirmar
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

    const nome = campoNome.value.trim();
    const user = campoUser.value.trim();
    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    const confirmar = campoConfirmar.value;

    let formValido = true;

    // validação do nome completo
    if (nome === "") {
        mostrarErro(campoNome, erroNome, "O nome é obrigatório!");
        formValido = false;
    } else if (nome.length < 5) {
        mostrarErro(campoNome, erroNome, "O nome deve possuir pelo menos 5 caracteres!");
        formValido = false;
    } else if (nome.split(/\s+/).length < 2) {
        mostrarErro(campoNome, erroNome, "Informe nome e sobrenome!");
        formValido = false;
    }

    // validação do nome de usuário
    if (user === "") {
        mostrarErro(campoUser, erroUser, "O nome de usuário é obrigatório!");
        formValido = false;
    } else if (user.length < 3) {
        mostrarErro(campoUser, erroUser, "O nome de usuário deve possuir pelo menos 3 caracteres!");
        formValido = false;
    }

    // validação do e-mail
    if (email === "") {
        mostrarErro(campoEmail, erroEmail, "O e-mail é obrigatório!");
        formValido = false;
    } else if (campoEmail.validity.typeMismatch) {
        mostrarErro(campoEmail, erroEmail, "Informe um e-mail válido!");
        formValido = false;
    }

    const possuiMaiuscula = /[A-Z]/.test(senha);
    const possuiMinuscula = /[a-z]/.test(senha);
    const possuiNumero = /[0-9]/.test(senha);

    // validação da senha
    if (senha === "") {
        mostrarErro(campoSenha, erroSenha, "A senha é obrigatória!");
        formValido = false;
    } else if (senha.length < 8 || !possuiMaiuscula || !possuiMinuscula || !possuiNumero) {
        mostrarErro(campoSenha, erroSenha, "A senha deve possuir 8 caracteres, uma letra maiúscula, uma minúscula e um número!");
        formValido = false;
    }

    // validação da confirmação de senha
    if (confirmar === "") {
        mostrarErro(campoConfirmar, erroConfirmar, "Confirme a senha!");
        formValido = false;
    } else if (senha !== confirmar) {
        mostrarErro(campoConfirmar, erroConfirmar, "As senhas não são iguais!");
        formValido = false;
    }

    // redireciona para a tela de login quando o cadastro for válido
    if (formValido) {
        window.location.href = "login.html";
    }
});