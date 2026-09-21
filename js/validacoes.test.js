/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descricao: Autoteste das regras de js/validacoes.js.
 *
 * Nao depende de navegador nem de biblioteca de teste. Para rodar:
 *     node js/validacoes.test.js
 * O programa encerra com erro se alguma regra deixar de valer.
 */

const assert = require('assert');

// As constantes abaixo vivem em js/dados.js quando o sistema roda no navegador.
// Aqui elas sao declaradas como globais para que as regras possam ser testadas
// isoladamente, sem carregar a camada de dados inteira.
global.PRIORIDADES = ['Critica', 'Alta', 'Media', 'Baixa'];
global.STATUS = {
  ABERTA: 'Aberta',
  ANDAMENTO: 'Em andamento',
  REVISAO: 'Em revisao',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada'
};
global.buscarProjeto = function (id) {
  return id === 1 ? { id: 1, nome: 'DemandaTrack' } : null;
};

const v = require('./validacoes.js');

/* ---------- dataValida ---------- */
assert.strictEqual(v.dataValida('2026-09-21'), true, 'data real deveria passar');
assert.strictEqual(v.dataValida('2026-02-29'), false, '2026 nao e bissexto');
assert.strictEqual(v.dataValida('2026-02-31'), false, '31 de fevereiro nao existe');
assert.strictEqual(v.dataValida('21/09/2026'), false, 'formato errado deveria falhar');
assert.strictEqual(v.dataValida(''), false, 'texto vazio nao e data');

/* ---------- validarDemanda ---------- */
const demandaBoa = {
  titulo: 'Corrigir erro no login',
  tipo: 'Defeito',
  prioridade: 'Critica',
  status: 'Aberta',
  projetoId: 1,
  prazo: '2026-09-25'
};
assert.deepStrictEqual(v.validarDemanda(demandaBoa), [], 'demanda valida nao deveria ter erros');

// Prazo e opcional.
const semPrazo = Object.assign({}, demandaBoa, { prazo: '' });
assert.deepStrictEqual(v.validarDemanda(semPrazo), [], 'prazo em branco e permitido');

// Tipo personalizado e permitido pela equipe.
const tipoLivre = Object.assign({}, demandaBoa, { tipo: 'Infraestrutura' });
assert.deepStrictEqual(v.validarDemanda(tipoLivre), [], 'tipo personalizado e permitido');

const ruim = { titulo: '  ', tipo: '', prioridade: 'Urgente', status: 'Parada', projetoId: 99, prazo: '2026-02-31' };
assert.strictEqual(v.validarDemanda(ruim).length, 6, 'demanda ruim deveria acusar os 6 erros');

/* ---------- separarDemandasValidas ---------- */
const original = console.warn;
console.warn = function () {}; // silencia os avisos esperados durante o teste
const resultado = v.separarDemandasValidas([demandaBoa, ruim, tipoLivre]);
console.warn = original;
assert.strictEqual(resultado.validas.length, 2, 'duas demandas deveriam sobrar');
assert.strictEqual(resultado.invalidas, 1, 'uma demanda deveria ser descartada');

/* ---------- validarBusca ---------- */
assert.strictEqual(v.validarBusca(''), '', 'busca vazia e valida: mostra tudo');
assert.notStrictEqual(v.validarBusca('   '), '', 'so espacos deveria acusar erro');
assert.notStrictEqual(v.validarBusca('a'), '', 'um caractere e pouco');
assert.strictEqual(v.validarBusca('ab'), '', 'dois caracteres ja valem');
assert.strictEqual(v.validarBusca('a'.repeat(100)), '', '100 caracteres e o limite');
assert.notStrictEqual(v.validarBusca('a'.repeat(101)), '', '101 caracteres passa do limite');

/* ---------- validarOpcao ---------- */
assert.strictEqual(v.validarOpcao('', ['Alta'], 'erro'), '', 'vazio significa Todos');
assert.strictEqual(v.validarOpcao('Alta', ['Alta'], 'erro'), '', 'opcao da lista e valida');
assert.strictEqual(v.validarOpcao('Urgente', ['Alta'], 'erro'), 'erro', 'opcao fora da lista e recusada');

console.log('validacoes.js: todas as regras passaram.');
