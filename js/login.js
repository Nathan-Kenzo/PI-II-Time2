/**
 * Autor: Felipe Oliveira dos Santos
 *
 * Validação da tela de login.
 */

const formulario = document.querySelector("#formLogin");
const campoEmail = document.querySelector("#email");
const campoSenha = document.querySelector("#senha");
const erroEmail = document.querySelector("#erroEmail");
const erroSenha = document.querySelector("#erroSenha");

const camposComErro = [
    campoEmail,
    campoSenha
];

const mensagensDeErro = [
    erroEmail,
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

formulario.addEventListener("submit", async function (event) {
    event.preventDefault();

    limparErros();

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    let formValido = true;

    // validação do nome de usuário
    if (email === "") {
        mostrarErro(campoEmail, erroEmail, "O nome de usuário é obrigatório!");
        formValido = false;
    } else if (email.length < 3) {
        mostrarErro(campoEmail, erroEmail, "O nome de usuário deve possuir pelo menos 3 caracteres!");
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
        try {

        const resposta = await fetch(
            "http://localhost:3000/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    senha
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {

            mostrarErro(
                campoEmail,
                erroEmail,
                dados.erro || "Erro ao realizar login."
            );

            return;
        }

        localStorage.setItem(
            "usuario",
            JSON.stringify(dados.usuario)
        );

        window.location.href = "dashboard.html";

    } catch (erro) {

        mostrarErro(
            campoEmail,
            erroEmail,
            "Não foi possível conectar ao servidor."
        );

        console.error(erro);
    }
    }
});