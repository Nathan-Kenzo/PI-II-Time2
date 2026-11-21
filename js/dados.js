/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descrição: Constantes do DemandaTrack, usuário logado e chamada à API.
 *
 * Os dados (projetos, usuários e demandas) ficam no banco Oracle e chegam pela
 * API (Node.js + TypeScript + Express). Este arquivo guarda só as listas fixas
 * do documento de visão, o usuário que a tela de login gravou no localStorage
 * e a função chamarApi, usada pelas telas internas.
 */

/* ==========================================================================
   Listas fixas exigidas pelo documento de visão.
   Os textos são os mesmos gravados no banco, com acento.
   ========================================================================== */

/* Tipos obrigatórios da demanda (item 2.2.1 do documento de visão) */
const TIPOS = ['Tarefa', 'Defeito', 'Melhoria', 'Documentação'];

/* Prioridades obrigatórias (item 2.2.2) */
const PRIORIDADES = ['Crítica', 'Alta', 'Média', 'Baixa'];

/* Status obrigatórios (item 2.2.3) */
const STATUS = {
  ABERTA: 'Aberta',
  ANDAMENTO: 'Em andamento',
  REVISAO: 'Em revisão',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada'
};

/* Perfis de acesso obrigatórios (item 2.1) */
const PERFIS = {
  ADMIN: 'Administrador',
  LIDER: 'Líder de Projeto',
  MEMBRO: 'Membro da Equipe'
};


/* ==========================================================================
   Usuário logado
   ========================================================================== */

/*
 * Usuário autenticado: o que a tela de login gravou no localStorage, no formato
 * { id, nome, email, perfil, projetos }. Os projetos são os ids vinculados ao
 * usuário no banco (o Administrador recebe a lista vazia, porque vê todos).
 * Sem login, volta para a tela de login e devolve null.
 */
function usuarioLogado() {
  let usuario = null;
  try {
    usuario = JSON.parse(localStorage.getItem('usuario'));
  } catch (erro) {
    usuario = null;
  }
  if (!usuario) {
    window.location.href = 'login.html';
    return null;
  }
  usuario.projetos = usuario.projetos || [];
  return usuario;
}


/* ==========================================================================
   Chamada à API
   ========================================================================== */

/* Endereço da API do DemandaTrack (backend/, iniciado com "npm run dev"). */
const API_URL = 'http://localhost:3000';

/*
 * Faz uma chamada à API e devolve sempre o mesmo formato, para a tela não
 * precisar repetir o tratamento de erro:
 *   { ok, status, dados, erro }
 * ok é true quando a API respondeu 2xx; dados é o JSON da resposta; erro é a
 * mensagem pronta para mostrar ao usuário (vazia quando deu certo).
 *
 * Quando a API recusa a requisição, ela responde { erro, detalhes }; os dois
 * são juntados na mensagem. Se o servidor estiver desligado, o fetch falha,
 * status fica 0 e a mensagem orienta o usuário.
 */
async function chamarApi(metodo, caminho, corpo) {
  let resposta;
  try {
    resposta = await fetch(API_URL + caminho, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined
    });
  } catch (erro) {
    console.warn('Falha ao chamar a API:', erro);
    return {
      ok: false,
      status: 0,
      dados: null,
      erro: 'A API não respondeu. Confira se o servidor está rodando em ' + API_URL + '.'
    };
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (erro) {
    dados = null;
  }

  if (!resposta.ok) {
    const texto = (dados && dados.erro) || 'Erro ' + resposta.status;
    const detalhes = dados && Array.isArray(dados.detalhes) ? ' ' + dados.detalhes.join(' ') : '';
    // Tira o ponto final que a API às vezes já manda, para não ficar "..".
    return { ok: false, status: resposta.status, dados: dados, erro: texto.replace(/\.$/, '') + '.' + detalhes };
  }
  if (dados === null) {
    return { ok: false, status: resposta.status, dados: null, erro: 'A API devolveu uma resposta inesperada.' };
  }
  return { ok: true, status: resposta.status, dados: dados, erro: '' };
}
