/**
 * Autor: Felipe Oliveira dos Santos
 *
 * Validação da tela de login e chamada a POST /login.
 */

// quem já entrou não precisa fazer login de novo
if (localStorage.getItem("usuario")) {
    window.location.href = "dashboard.html";
}

const formulario = document.querySelector("#formLogin");
const campoEmail = document.querySelector("#email");
const campoSenha = document.querySelector("#senha");
const erroEmail = document.querySelector("#erroEmail");
const erroSenha = document.querySelector("#erroSenha");
const erroGeral = document.querySelector("#erroGeral");

const camposComErro = [
    campoEmail,
    campoSenha
];

const mensagensDeErro = [
    erroEmail,
    erroSenha,
    erroGeral
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

formulario.addEventListener("submit", async function (event) {
    event.preventDefault();

    limparErros();

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    let formValido = true;

    // validação do e-mail
    if (email === "") {
        mostrarErro(campoEmail, erroEmail, "O e-mail é obrigatório!");
        formValido = false;
    } else if (campoEmail.validity.typeMismatch) {
        mostrarErro(campoEmail, erroEmail, "Informe um e-mail válido!");
        formValido = false;
    }

    // validação da senha (as regras de senha forte valem só no cadastro)
    if (senha === "") {
        mostrarErro(campoSenha, erroSenha, "A senha é obrigatória!");
        formValido = false;
    }

    if (!formValido) {
        return;
    }

    // falha aqui = servidor fora do ar
    let resposta;
    try {
        resposta = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha })
        });
    } catch (erro) {
        console.error(erro);
        erroGeral.innerText = "Não foi possível conectar ao servidor. Confira se a API está rodando.";
        return;
    }

    let dados = {};
    try {
        dados = await resposta.json();
    } catch (erro) {
        dados = {};
    }

    // e-mail ou senha errados: destaca os dois campos sem dizer qual errou
    if (resposta.status === 401) {
        campoEmail.classList.add("erro-campo");
        campoSenha.classList.add("erro-campo");
        erroGeral.innerText = "E-mail ou senha incorretos.";
        return;
    }

    if (!resposta.ok || !dados.usuario) {
        erroGeral.innerText = dados.erro || "Erro ao realizar login.";
        return;
    }

    // guarda { id, nome, email, perfil, projetos } para as outras telas (js/dados.js)
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));

    window.location.href = "dashboard.html";
});
