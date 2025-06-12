/**
 * Arquivo de configuração para o scraper
 */

const path = require('path');

module.exports = {
  "urls": {
    "tjmg": "https://www8.tjmg.jus.br/juridico/pe/consultaPorEntidadeDevedora.jsf",
    "pje": "https://pje-consulta-publica.tjmg.jus.br/"
  },
  "consulta": {
    "entidade": "MUNICÍPIO DE BELO HORIZONTE",
    "anoInicio": "2026",
    "anoFim": "2027",
    "ocultarFechados": true,
    "maxPages": 100
  },
  "browser": {
    "headless": false,
    "width": 1366,
    "height": 768,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "timeout": 60000,
    "args": [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu"
    ]
  },
  "humanBehavior": {
    "minDelay": 500,
    "maxDelay": 2000,
    "typeSpeed": {
      "min": 50,
      "max": 150
    }
  },
  "selectors": {
    "tjmg": {
      "entidadeInput": "#entidade_devedora_input",
      "entidadeSuggestion": ".ui-autocomplete-item",
      "anoInicioInput": "#anoInicio",
      "anoFimInput": "#anoFim",
      "consultarButton": "button[id$=\":consultar\"]",
      "resultTable": "#resultado_data",
      "paginatorCurrent": ".ui-paginator-current",
      "nextPageButton": ".ui-paginator-next",
      "loadingIndicator": "#j_idt160"
    },
    "pje": {
      "processoInput": "#fPP\\:numProcesso-inputNumeroProcessoDecoration\\:numProcesso-inputNumeroProcesso",
      "verDetalhesLink": "a[title=\"Ver Detalhes\"]",
      "partyInfoTable": "#j_id134\\:processoPartesPoloAtivoResumidoList\\:tb"
    }
  },
  "columns": [
    "empty",
    "entidade",
    "codigo",
    "ano",
    "natureza",
    "processo",
    "data_protocolo",
    "credor",
    "status",
    "numero"
  ],
  "outputDir": "E:\\5 - Projetos\\Diego - Precatorias\\firebase_prod\\scraper-tjmg\\output"
};
