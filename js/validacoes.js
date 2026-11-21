/**
 * Autor das validações de demanda: Felipe Oliveira Barbosa
 * Autor das validações de filtro: Nathan Kenzo Puzipe
 * Adaptação para a camada de dados compartilhada: Pedro Tiezo Sales Shimizu
 *
 * Descrição: Regras de validação da demanda e dos filtros da listagem.
 *
 * As funções deste arquivo são puras: recebem valores e devolvem a lista de
 * erros ou a mensagem de erro, sem mexer na tela. Quem exibe o resultado é a
 * tela que chamou. Isso permite testar as regras isoladamente (js/validacoes.test.js).
 */


/* ==========================================================================
   Validação dos dados da demanda
   Escrita originalmente em js/dashboard.js por Felipe Oliveira Barbosa.
   ========================================================================== */

/* Confere se o texto é uma data real no formato aaaa-mm-dd. */
function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const partes = texto.split('-');
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  // Se o dia não existir no mês (ex.: 31/02), o Date "corrige" e os valores mudam.
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

/*
 * Devolve a lista de erros de uma demanda (lista vazia = demanda válida).
 *
 * O tipo é conferido na lista fixa pela API. O projeto também é conferido
 * pela API, no banco.
 */
function validarDemanda(demanda) {
  const erros = [];

  if (typeof demanda.titulo !== 'string' || demanda.titulo.trim() === '') {
    erros.push('título vazio');
  }
  if (typeof demanda.tipo !== 'string' || demanda.tipo.trim() === '') {
    erros.push('tipo vazio');
  }
  if (PRIORIDADES.indexOf(demanda.prioridade) < 0) {
    erros.push('prioridade inválida (' + demanda.prioridade + ')');
  }
  if (Object.values(STATUS).indexOf(demanda.status) < 0) {
    erros.push('status inválido (' + demanda.status + ')');
  }

  // O prazo é opcional, mas se vier preenchido tem que ser uma data real.
  if (demanda.prazo && !dataValida(demanda.prazo)) {
    erros.push('prazo inválido (' + demanda.prazo + ')');
  }

  return erros;
}

/*
 * Separa as demandas válidas das inválidas.
 * As inválidas ficam de fora, mas são registradas no console
 * para que o problema não passe despercebido durante o desenvolvimento.
 */
function separarDemandasValidas(demandas) {
  const validas = [];
  let invalidas = 0;

  demandas.forEach(function (demanda) {
    const erros = validarDemanda(demanda);
    if (erros.length === 0) {
      validas.push(demanda);
    } else {
      invalidas++;
      console.warn('Demanda ignorada (' + demanda.titulo + '): ' + erros.join(', '));
    }
  });

  return { validas: validas, invalidas: invalidas };
}


/* ==========================================================================
   Validação dos filtros da listagem
   Escrita originalmente em js/listagem.js por Nathan Kenzo Puzipe.

   Nenhum filtro é obrigatório: uma listagem sem filtro é o estado normal da
   tela. As regras só valem quando o campo está preenchido.
   ========================================================================== */

const REGRA_BUSCA = { min: 2, max: 100 };

/* Busca por título ou descrição: sem conter apenas espaços, entre 2 e 100 caracteres. */
function validarBusca(valor) {
  const texto = String(valor).trim();

  if (texto === '') {
    // Digitou algo, mas só espaços em branco.
    return String(valor).length > 0 ? 'A busca não pode conter apenas espaços.' : '';
  }
  if (texto.length < REGRA_BUSCA.min) {
    return 'Digite pelo menos ' + REGRA_BUSCA.min + ' caracteres.';
  }
  if (texto.length > REGRA_BUSCA.max) {
    return 'Use no máximo ' + REGRA_BUSCA.max + ' caracteres.';
  }
  return '';
}

/*
 * Select de lista fechada. Vazio significa "Todos", que é válido.
 * Qualquer valor fora da lista (por exemplo, HTML alterado no navegador)
 * é recusado.
 */
function validarOpcao(valor, permitidas, mensagem) {
  if (valor === '') {
    return '';
  }
  return permitidas.indexOf(valor) >= 0 ? '' : mensagem;
}


/* Permite testar as regras no Node: require('./validacoes.js'). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dataValida: dataValida,
    validarDemanda: validarDemanda,
    separarDemandasValidas: separarDemandasValidas,
    validarBusca: validarBusca,
    validarOpcao: validarOpcao,
    REGRA_BUSCA: REGRA_BUSCA
  };
}
