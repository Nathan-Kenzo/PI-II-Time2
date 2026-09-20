/**
 * =====================================================================
 * Arquivo : listagem.js
 * Autor   : Nathan Kenzo Puzipe (Japa)
 * Projeto : PI2 – DemandaTrack (Sistema de Acompanhamento de Demandas)
 * Etapa   : Reunião 3 – parte individual (validações em JavaScript)
 * Tela    : Listagem de demandas (html/listagem.html)
 * ---------------------------------------------------------------------
 * O que este arquivo faz
 *   1) VALIDAÇÕES: confere os filtros (Buscar, Status, Prioridade, Tipo
 *      e Responsável) antes de filtrar. Se houver dado inválido, o
 *      envio é bloqueado, o campo recebe uma mensagem de erro clara e o
 *      foco vai para o primeiro campo com problema.
 *   2) FILTRAGEM: com os dados válidos, esconde as linhas da tabela que
 *      não combinam com os filtros (todos valem juntos) e mostra
 *      "Exibindo X de Y demandas".
 *
 * Por que nenhum filtro é obrigatório
 *   Uma listagem sem filtro é o estado normal da tela (mostra tudo).
 *   Exigir preenchimento seria uma validação sem sentido aqui. As
 *   regras valem quando o campo é preenchido.
 *
 * Organização do arquivo
 *   Seção 1 – Configuração (IDs e regras)
 *   Seção 2 – Funções de validação
 *   Seção 3 – Leitura e filtragem da tabela
 *   Seção 4 – Formulário: erros na tela e envio
 *   Seção 5 – Inicialização
 *
 * A busca compara o título e, se a linha tiver o atributo
 * data-descricao, também a descrição. Ignora maiúsculas e acentos.
 *
 * Nas próximas etapas, a filtragem local (seção 3) poderá ser trocada
 * por uma chamada à API do backend Node.js; as validações (seção 2)
 * continuam valendo.
 * =====================================================================
 */
(function () {
  'use strict';

  /* ===================================================================
   * 1. CONFIGURAÇÃO
   * =================================================================== */

  // IDs dos elementos em html/listagem.html.
  const IDS = {
    formulario: 'form-filtros',
    resumoErros: 'resumo-erros',
    botaoLimpar: 'btn-limpar',
    contagem: 'contagem',
    // A ordem desta lista define qual campo recebe o foco primeiro
    // (mesma ordem em que aparecem na tela).
    campos: {
      busca: 'filtro-busca',
      status: 'filtro-status',
      prioridade: 'filtro-prioridade',
      tipo: 'filtro-tipo',
      responsavel: 'filtro-responsavel'
    }
  };

  // Como a tabela representa "sem responsável" (célula com "-").
  const SEM_RESPONSAVEL = 'Sem responsável';

  // Regras de negócio da tela (vêm do escopo do PI2 e dos status
  // usados na listagem).
  const REGRAS = {
    busca: { min: 2, max: 100 },
    tipo: ['Tarefa', 'Defeito', 'Melhoria', 'Documentação'],
    prioridade: ['Crítica', 'Alta', 'Média', 'Baixa'],
    status: ['Aberta', 'Em andamento', 'Em revisão', 'Concluída', 'Cancelada'],
    // Preenchida na inicialização com os responsáveis que existem na
    // tabela. Enquanto for null, o campo não é checado contra lista.
    responsavel: null
  };

  /* ===================================================================
   * 2. FUNÇÕES DE VALIDAÇÃO (puras: recebem valores, devolvem mensagem)
   *    Retornam '' quando o valor é válido.
   * =================================================================== */

  /** Busca por título/descrição: sem só espaços, entre 2 e 100 caracteres. */
  function validarBusca(valor) {
    const texto = String(valor).trim();
    if (texto === '') {
      // Digitou algo, mas só espaços em branco.
      return String(valor).length > 0
        ? 'A busca não pode conter apenas espaços.'
        : '';
    }
    if (texto.length < REGRAS.busca.min) {
      return 'Digite pelo menos ' + REGRAS.busca.min + ' caracteres.';
    }
    if (texto.length > REGRAS.busca.max) {
      return 'Use no máximo ' + REGRAS.busca.max + ' caracteres.';
    }
    return '';
  }

  /**
   * Select com lista fechada. Vazio = "Todos" (válido).
   * Qualquer valor fora da lista (ex.: HTML alterado no navegador)
   * é recusado.
   */
  function validarOpcao(valor, permitidas, mensagem) {
    if (valor === '') return '';
    return permitidas.indexOf(valor) !== -1 ? '' : mensagem;
  }

  function validarTipo(valor) {
    return validarOpcao(valor, REGRAS.tipo, 'Selecione um tipo válido.');
  }

  function validarPrioridade(valor) {
    return validarOpcao(valor, REGRAS.prioridade, 'Selecione uma prioridade válida.');
  }

  function validarStatus(valor) {
    return validarOpcao(valor, REGRAS.status, 'Selecione um status válido.');
  }

  function validarResponsavel(valor) {
    if (REGRAS.responsavel === null) return ''; // lista ainda não montada
    return validarOpcao(valor, REGRAS.responsavel, 'Selecione um responsável válido.');
  }

  /**
   * Valida todos os filtros de uma vez.
   * @param {Object} v  valores brutos dos campos
   * @returns {{valido: boolean, erros: Object}}  erros indexado por campo
   */
  function validarFiltros(v) {
    const erros = {};

    const eBusca = validarBusca(v.busca);
    if (eBusca) erros.busca = eBusca;

    const eStatus = validarStatus(v.status);
    if (eStatus) erros.status = eStatus;

    const ePrioridade = validarPrioridade(v.prioridade);
    if (ePrioridade) erros.prioridade = ePrioridade;

    const eTipo = validarTipo(v.tipo);
    if (eTipo) erros.tipo = eTipo;

    const eResponsavel = validarResponsavel(v.responsavel);
    if (eResponsavel) erros.responsavel = eResponsavel;

    return { valido: Object.keys(erros).length === 0, erros: erros };
  }

  /* ===================================================================
   * 3. LEITURA E FILTRAGEM DA TABELA
   * =================================================================== */

  /** Minúsculas e sem acentos, para a busca não depender disso. */
  function normalizar(texto) {
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Lê a tabela e devolve um objeto com tudo que a filtragem precisa.
   * Retorna null (e avisa no console) se algo esperado não existir.
   */
  function prepararTabela() {
    const tabela = document.querySelector('.tabela-demandas');
    if (!tabela) return null;

    // Descobre em qual coluna está cada informação lendo o cabeçalho,
    // então continua funcionando se a ordem das colunas mudar.
    const cabecalhos = Array.prototype.map.call(
      tabela.querySelectorAll('.linha-cabecalho th'),
      function (th) { return normalizar(th.textContent); }
    );
    const coluna = {
      titulo: cabecalhos.indexOf('titulo'),
      tipo: cabecalhos.indexOf('tipo'),
      prioridade: cabecalhos.indexOf('prioridade'),
      status: cabecalhos.indexOf('status'),
      responsavel: cabecalhos.indexOf('responsavel')
    };
    const faltando = Object.keys(coluna).filter(function (k) { return coluna[k] === -1; });
    if (faltando.length > 0) {
      console.error('listagem.js: coluna(s) não encontrada(s) no cabeçalho: ' + faltando.join(', '));
      return null;
    }

    // Linhas de dados (tudo que não é o cabeçalho).
    const linhas = Array.prototype.filter.call(
      tabela.querySelectorAll('tr'),
      function (tr) { return !tr.classList.contains('linha-cabecalho'); }
    );

    function textoDaCelula(tr, indice) {
      return tr.cells[indice] ? tr.cells[indice].textContent.trim() : '';
    }

    const demandas = linhas.map(function (tr) {
      const responsavel = textoDaCelula(tr, coluna.responsavel);
      return {
        tr: tr,
        titulo: textoDaCelula(tr, coluna.titulo),
        descricao: tr.getAttribute('data-descricao') || '',
        tipo: textoDaCelula(tr, coluna.tipo),
        prioridade: textoDaCelula(tr, coluna.prioridade),
        status: textoDaCelula(tr, coluna.status),
        responsavel: (responsavel === '' || responsavel === '-') ? SEM_RESPONSAVEL : responsavel
      };
    });

    // Linha "nenhum resultado", criada aqui e mostrada só quando precisa.
    const linhaVazia = document.createElement('tr');
    linhaVazia.className = 'linha-vazia';
    linhaVazia.hidden = true;
    const celulaVazia = document.createElement('td');
    celulaVazia.colSpan = cabecalhos.length;
    celulaVazia.textContent = 'Nenhuma demanda encontrada com esses filtros.';
    linhaVazia.appendChild(celulaVazia);
    (tabela.tBodies[0] || tabela).appendChild(linhaVazia);

    return { demandas: demandas, linhaVazia: linhaVazia };
  }

  /** Nomes de responsáveis presentes na tabela ("Sem responsável" por último). */
  function listarResponsaveis(demandas) {
    const nomes = [];
    demandas.forEach(function (d) {
      if (d.responsavel !== SEM_RESPONSAVEL && nomes.indexOf(d.responsavel) === -1) {
        nomes.push(d.responsavel);
      }
    });
    nomes.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    if (demandas.some(function (d) { return d.responsavel === SEM_RESPONSAVEL; })) {
      nomes.push(SEM_RESPONSAVEL);
    }
    return nomes;
  }

  /* ===================================================================
   * 4. FORMULÁRIO: ERROS NA TELA E ENVIO
   * =================================================================== */

  function iniciar() {
    const form = document.getElementById(IDS.formulario);
    if (!form) return; // página sem o formulário: não faz nada

    const tabela = prepararTabela();
    if (!tabela) return;
    const demandas = tabela.demandas;
    const linhaVazia = tabela.linhaVazia;

    // Desliga as mensagens padrão do navegador para usar as nossas.
    form.noValidate = true;

    const chaves = Object.keys(IDS.campos);
    const campos = {};
    chaves.forEach(function (chave) {
      campos[chave] = document.getElementById(IDS.campos[chave]);
    });

    const resumo = document.getElementById(IDS.resumoErros);
    const contagem = document.getElementById(IDS.contagem);

    /* ---- Filtro de Responsável: montado com os nomes da tabela ---- */
    const nomes = listarResponsaveis(demandas);
    if (campos.responsavel) {
      nomes.forEach(function (nome) {
        const opcao = document.createElement('option');
        opcao.value = nome;
        opcao.textContent = nome;
        campos.responsavel.appendChild(opcao);
      });
    }
    REGRAS.responsavel = nomes; // a validação só aceita esses nomes

    /* ---- Aplicação dos filtros na tabela ---- */
    function mostrarResultado(visiveis) {
      linhaVazia.hidden = visiveis > 0;
      if (contagem) {
        contagem.textContent = 'Exibindo ' + visiveis + ' de ' + demandas.length +
          (demandas.length === 1 ? ' demanda.' : ' demandas.');
      }
    }

    /** Todos os filtros preenchidos precisam combinar (E lógico). */
    function aplicarFiltros(f) {
      const termo = normalizar(f.busca);
      let visiveis = 0;

      demandas.forEach(function (d) {
        const combina =
          (termo === '' || normalizar(d.titulo + ' ' + d.descricao).indexOf(termo) !== -1) &&
          (f.status === '' || d.status === f.status) &&
          (f.prioridade === '' || d.prioridade === f.prioridade) &&
          (f.tipo === '' || d.tipo === f.tipo) &&
          (f.responsavel === '' || d.responsavel === f.responsavel);

        d.tr.hidden = !combina;
        if (combina) visiveis++;
      });

      mostrarResultado(visiveis);
    }

    /* ---- Mensagens de erro na tela ---- */

    /** Encontra (ou cria) o <span> que exibe o erro de um campo. */
    function obterElementoErro(campo) {
      let el = document.querySelector('[data-erro-para="' + campo.id + '"]');
      if (!el) {
        el = document.createElement('span');
        el.className = 'mensagem-erro';
        el.setAttribute('data-erro-para', campo.id);
        campo.insertAdjacentElement('afterend', el);
      }
      if (!el.id) el.id = 'erro-' + campo.id;
      el.hidden = true;
      return el;
    }

    // Liga cada campo ao seu elemento de erro (leitores de tela).
    chaves.forEach(function (chave) {
      const campo = campos[chave];
      if (!campo) return;
      const el = obterElementoErro(campo);
      campo.setAttribute('aria-describedby', el.id);
    });

    function lerValores() {
      const v = {};
      chaves.forEach(function (chave) {
        v[chave] = campos[chave] ? campos[chave].value : '';
      });
      return v;
    }

    function mostrarErro(chave, mensagem) {
      const campo = campos[chave];
      if (!campo) return;
      const el = document.querySelector('[data-erro-para="' + campo.id + '"]');
      if (mensagem) {
        campo.setAttribute('aria-invalid', 'true');
        campo.classList.add('invalido');
        el.textContent = mensagem;
        el.hidden = false;
      } else {
        campo.removeAttribute('aria-invalid');
        campo.classList.remove('invalido');
        el.textContent = '';
        el.hidden = true;
      }
    }

    function atualizarResumo(quantidade) {
      if (!resumo) return;
      if (quantidade === 0) {
        resumo.textContent = '';
        resumo.hidden = true;
        return;
      }
      resumo.textContent = quantidade === 1
        ? 'Corrija 1 campo antes de filtrar.'
        : 'Corrija ' + quantidade + ' campos antes de filtrar.';
      resumo.hidden = false;
    }

    /** Valida tudo, mas só exibe o erro dos campos listados. */
    function validarEExibir(chavesParaExibir) {
      const resultado = validarFiltros(lerValores());
      chavesParaExibir.forEach(function (chave) {
        mostrarErro(chave, resultado.erros[chave] || '');
      });
      return resultado;
    }

    /* ---- Validação ao trocar um select ---- */
    ['status', 'prioridade', 'tipo', 'responsavel'].forEach(function (chave) {
      if (campos[chave]) {
        campos[chave].addEventListener('change', function () {
          validarEExibir([chave]);
        });
      }
    });

    /* ---- Validação da busca ao sair do campo ---- */
    if (campos.busca) {
      campos.busca.addEventListener('blur', function () {
        validarEExibir(['busca']);
      });
      // Se já estava com erro, revalida a cada tecla para o erro sumir
      // assim que o usuário corrigir.
      campos.busca.addEventListener('input', function () {
        if (campos.busca.classList.contains('invalido')) {
          validarEExibir(['busca']);
        }
      });
    }

    /* ---- Envio do formulário ---- */
    form.addEventListener('submit', function (evento) {
      // Sempre interrompe o envio padrão; só filtramos se estiver válido.
      evento.preventDefault();

      const resultado = validarEExibir(chaves);
      atualizarResumo(Object.keys(resultado.erros).length);

      if (!resultado.valido) {
        // Foco no primeiro campo inválido, na ordem de IDS.campos.
        for (let i = 0; i < chaves.length; i++) {
          if (resultado.erros[chaves[i]] && campos[chaves[i]]) {
            campos[chaves[i]].focus();
            break;
          }
        }
        return; // bloqueado enquanto houver dado inválido
      }

      // Tudo certo: normaliza o texto da busca e filtra a tabela.
      const valores = lerValores();
      valores.busca = valores.busca.trim();
      if (campos.busca) campos.busca.value = valores.busca;
      aplicarFiltros(valores);
    });

    /* ---- Botão "Limpar" ---- */
    const botaoLimpar = document.getElementById(IDS.botaoLimpar);
    if (botaoLimpar) {
      botaoLimpar.addEventListener('click', function () {
        form.reset();
        chaves.forEach(function (chave) { mostrarErro(chave, ''); });
        atualizarResumo(0);
        aplicarFiltros({ busca: '', status: '', prioridade: '', tipo: '', responsavel: '' });
        if (campos.busca) campos.busca.focus();
      });
    }

    mostrarResultado(demandas.length); // estado inicial: tudo visível
  }

  /* ===================================================================
   * 5. INICIALIZAÇÃO E EXPORTAÇÃO
   * =================================================================== */

  // Permite testar as regras no Node: require('./listagem.js').
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      REGRAS: REGRAS,
      validarBusca: validarBusca,
      validarTipo: validarTipo,
      validarPrioridade: validarPrioridade,
      validarStatus: validarStatus,
      validarResponsavel: validarResponsavel,
      validarFiltros: validarFiltros
    };
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciar);
    } else {
      iniciar();
    }
  }
})();