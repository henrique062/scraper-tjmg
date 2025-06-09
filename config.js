/**
 * Arquivo de configuração para o scraper
 */

const path = require('path');

module.exports = {
  // URLs dos sites
  urls: {
    tjmg: 'https://www8.tjmg.jus.br/juridico/pe/consultaPorEntidadeDevedora.jsf',
    pje: 'https://pje-consulta-publica.tjmg.jus.br/'
  },
  
  // Parâmetros da consulta
  consulta: {
    entidade: 'MUNICÍPIO DE BOCAIÚVA',
    anoInicio: '2026',
    anoFim: '2026',
    ocultarFechados: false,
    maxPages: 2 // Limita o número de páginas a serem extraídas (para testes)
  },
  
  // Configurações do navegador
  browser: {
    headless: false, // Defina como false para executar em modo não-headless
    width: 1366,
    height: 768,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    timeout: 60000 // 60 segundos
  },
  
  // Configurações de comportamento humano
  humanBehavior: {
    minDelay: 500,
    maxDelay: 2000,
    typeSpeed: {
      min: 50,
      max: 150
    }
  },
  
  // Seletores para o site do TJMG
  selectors: {
    tjmg: {
      entidadeInput: '#entidade_devedora_input',
      entidadeSuggestion: '.ui-autocomplete-item',
      anoInicioInput: '#anoInicio',
      anoFimInput: '#anoFim',
      consultarButton: 'button[id$=":consultar"]',
      resultTable: '#resultado_data',
      paginatorCurrent: '.ui-paginator-current',
      nextPageButton: '.ui-paginator-next',
      loadingIndicator: '#j_idt160'
    },
    pje: {            
      processoInput: '#fPP\\:numProcesso-inputNumeroProcessoDecoration\\:numProcesso-inputNumeroProcesso',
      verDetalhesLink: 'a[title="Ver Detalhes"]',
      partyInfoTable: '#j_id134\\:processoPartesPoloAtivoResumidoList\\:tb'
    }
  },
  
  // Mapeamento de colunas para extração de dados do TJMG
  columns: [
    'empty', // ou "actions" se for uma coluna de botão/link
    'entidade',
    'codigo',
    'ano',
    'natureza',
    'processo',
    'data_protocolo',
    'credor',
    'status',
    'numero',
  ],
  
  // Diretório de saída para os arquivos JSON
  outputDir: path.join(__dirname, 'output')
};

