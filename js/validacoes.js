/**
 * Autor das validacoes de demanda: Felipe Oliveira Barbosa
 * Autor das validacoes de filtro: Nathan Kenzo Puzipe
 * Adaptacao para a camada de dados compartilhada: Pedro Tiezo Sales Shimizu
 *
 * Descricao: Regras de validacao usadas pelo dashboard e pela listagem.
 *
 * As funcoes deste arquivo sao puras: recebem valores e devolvem a lista de
 * erros ou a mensagem de erro, sem mexer na tela. Quem exibe o resultado e a
 * tela que chamou. Isso permite testar as regras isoladamente e reaproveitar
 * as mesmas validacoes quando a API do backend existir.
 */


/* ==========================================================================
   Validacao dos dados da demanda
   Escrita originalmente em js/dashboard.js por Felipe Oliveira Barbosa.
   ========================================================================== */

/* Confere se o texto e uma data real no formato aaaa-mm-dd. */
function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const partes = texto.split('-');
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  // Se o dia nao existir no mes (ex.: 31/02), o Date "corrige" e os valores mudam.
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

/*
 * Devolve a lista de erros de uma demanda (lista vazia = demanda valida).
 *
 * O tipo aceita texto livre, porque a equipe permitiu tipos personalizados
 * alem dos quatro obrigatorios (ver TIPO_PERSONALIZADO em js/dados.js).
 */
function validarDemanda(demanda) {
  const erros = [];

  if (typeof demanda.titulo !== 'string' || demanda.titulo.trim() === '') {
    erros.push('titulo vazio');
  }
  if (typeof demanda.tipo !== 'string' || demanda.tipo.trim() === '') {
    erros.push('tipo vazio');
  }
  if (PRIORIDADES.indexOf(demanda.prioridade) < 0) {
    erros.push('prioridade invalida (' + demanda.prioridade + ')');
  }
  if (Object.values(STATUS).indexOf(demanda.status) < 0) {
    erros.push('status invalido (' + demanda.status + ')');
  }
  if (!buscarProjeto(demanda.projetoId)) {
    erros.push('projeto inexistente (' + demanda.projetoId + ')');
  }

  // O prazo e opcional, mas se vier preenchido tem que ser uma data real.
  if (demanda.prazo && !dataValida(demanda.prazo)) {
    erros.push('prazo invalido (' + demanda.prazo + ')');
  }

  return erros;
}

/*
 * Separa as demandas validas das invalidas.
 * As invalidas ficam de fora dos indicadores, mas sao registradas no console
 * para que o problema nao passe despercebido durante o desenvolvimento.
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
   Validacao dos filtros da listagem
   Escrita originalmente em js/listagem.js por Nathan Kenzo Puzipe.

   Nenhum filtro e obrigatorio: uma listagem sem filtro e o estado normal da
   tela. As regras so valem quando o campo esta preenchido.
   ========================================================================== */

const REGRA_BUSCA = { min: 2, max: 100 };

/* Busca por titulo ou descricao: sem conter apenas espacos, entre 2 e 100 caracteres. */
function validarBusca(valor) {
  const texto = String(valor).trim();

  if (texto === '') {
    // Digitou algo, mas so espacos em branco.
    return String(valor).length > 0 ? 'A busca nao pode conter apenas espacos.' : '';
  }
  if (texto.length < REGRA_BUSCA.min) {
    return 'Digite pelo menos ' + REGRA_BUSCA.min + ' caracteres.';
  }
  if (texto.length > REGRA_BUSCA.max) {
    return 'Use no maximo ' + REGRA_BUSCA.max + ' caracteres.';
  }
  return '';
}

/*
 * Select de lista fechada. Vazio significa "Todos", que e valido.
 * Qualquer valor fora da lista (por exemplo, HTML alterado no navegador)
 * e recusado.
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
