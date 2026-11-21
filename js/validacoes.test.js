/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descrição: Autoteste das regras de js/validacoes.js.
 *
 * Não depende de navegador nem de biblioteca de teste. Para rodar:
 *     node js/validacoes.test.js
 * O programa encerra com erro se alguma regra deixar de valer.
 */

const assert = require('assert');

// As constantes abaixo vivem em js/dados.js quando o sistema roda no navegador.
// Aqui elas são declaradas como globais para que as regras possam ser testadas
// isoladamente, sem carregar o arquivo inteiro.
global.PRIORIDADES = ['Crítica', 'Alta', 'Média', 'Baixa'];
global.STATUS = {
  ABERTA: 'Aberta',
  ANDAMENTO: 'Em andamento',
  REVISAO: 'Em revisão',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada'
};

const v = require('./validacoes.js');

/* ---------- dataValida ---------- */
assert.strictEqual(v.dataValida('2026-09-21'), true, 'data real deveria passar');
assert.strictEqual(v.dataValida('2026-02-29'), false, '2026 não é bissexto');
assert.strictEqual(v.dataValida('2026-02-31'), false, '31 de fevereiro não existe');
assert.strictEqual(v.dataValida('21/09/2026'), false, 'formato errado deveria falhar');
assert.strictEqual(v.dataValida(''), false, 'texto vazio não é data');

/* ---------- validarDemanda ---------- */
const demandaBoa = {
  titulo: 'Corrigir erro no login',
  tipo: 'Defeito',
  prioridade: 'Crítica',
  status: 'Aberta',
  projetoId: 1,
  prazo: '2026-09-25'
};
assert.deepStrictEqual(v.validarDemanda(demandaBoa), [], 'demanda válida não deveria ter erros');

// Prazo é opcional.
const semPrazo = Object.assign({}, demandaBoa, { prazo: '' });
assert.deepStrictEqual(v.validarDemanda(semPrazo), [], 'prazo em branco é permitido');

const ruim = { titulo: '  ', tipo: '', prioridade: 'Urgente', status: 'Parada', projetoId: 99, prazo: '2026-02-31' };
assert.strictEqual(v.validarDemanda(ruim).length, 5, 'demanda ruim deveria acusar os 5 erros');

// Os valores trafegam com acento, como no banco: sem acento não vale.
const semAcentoNoValor = Object.assign({}, demandaBoa, { prioridade: 'Critica' });
assert.strictEqual(v.validarDemanda(semAcentoNoValor).length, 1, 'prioridade sem acento deveria ser recusada');

/* ---------- separarDemandasValidas ---------- */
const original = console.warn;
console.warn = function () {}; // silencia os avisos esperados durante o teste
const resultado = v.separarDemandasValidas([demandaBoa, ruim]);
console.warn = original;
assert.strictEqual(resultado.validas.length, 1, 'uma demanda deveria sobrar');
assert.strictEqual(resultado.invalidas, 1, 'uma demanda deveria ser descartada');

/* ---------- validarBusca ---------- */
assert.strictEqual(v.validarBusca(''), '', 'busca vazia é válida: mostra tudo');
assert.notStrictEqual(v.validarBusca('   '), '', 'só espaços deveria acusar erro');
assert.notStrictEqual(v.validarBusca('a'), '', 'um caractere é pouco');
assert.strictEqual(v.validarBusca('ab'), '', 'dois caracteres ja valem');
assert.strictEqual(v.validarBusca('a'.repeat(100)), '', '100 caracteres é o limite');
assert.notStrictEqual(v.validarBusca('a'.repeat(101)), '', '101 caracteres passa do limite');

/* ---------- validarOpcao ---------- */
assert.strictEqual(v.validarOpcao('', ['Alta'], 'erro'), '', 'vazio significa Todos');
assert.strictEqual(v.validarOpcao('Alta', ['Alta'], 'erro'), '', 'opção da lista é válida');
assert.strictEqual(v.validarOpcao('Urgente', ['Alta'], 'erro'), 'erro', 'opção fora da lista é recusada');

console.log('validacoes.js: todas as regras passaram.');
