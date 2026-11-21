/**
 * Autor: Pedro Tiezo Sales Shimizu
 * Descrição: Funções de formatação e exibição usadas por mais de uma tela
 *            (dashboard, listagem e demanda). Evita repetir o mesmo código
 *            em cada arquivo.
 */

/* Tira os acentos de um texto ("Em revisão" vira "Em revisao"). Usada só para comparar. */
function semAcento(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/*
 * Traduz um status ou uma prioridade para a classe de cor correspondente no CSS.
 * A comparação ignora acentos, então "Em revisão" e "Em revisao" dão a mesma cor.
 */
function classeDaEtiqueta(valor) {
  const mapa = {
    'Aberta': 'etiqueta-aberta',
    'Em andamento': 'etiqueta-andamento',
    'Em revisao': 'etiqueta-revisao',
    'Concluida': 'etiqueta-concluida',
    'Cancelada': 'etiqueta-cancelada',
    'Critica': 'etiqueta-critica',
    'Alta': 'etiqueta-alta',
    'Media': 'etiqueta-media',
    'Baixa': 'etiqueta-baixa'
  };
  return mapa[semAcento(valor)] || '';
}

/* Cria o elemento visual da etiqueta colorida de status ou de prioridade. */
function criarEtiqueta(valor) {
  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta ' + classeDaEtiqueta(valor);
  etiqueta.textContent = valor;
  return etiqueta;
}

/* Data de hoje no formato aaaa-mm-dd, usado para comparar com campos de data. */
function dataDeHoje() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return hoje.getFullYear() + '-' + mes + '-' + dia;
}

/* Converte aaaa-mm-dd para dd/mm/aaaa. */
function formatarData(data) {
  if (!data) {
    return 'sem prazo';
  }
  const partes = data.substring(0, 10).split('-');
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

/* Converte a data/hora armazenada para dd/mm/aaaa hh:mm. */
function formatarDataHora(valor) {
  if (!valor) {
    return '-';
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return valor;
  }
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return dia + '/' + mes + '/' + data.getFullYear() + ' ' + hora + ':' + minuto;
}
