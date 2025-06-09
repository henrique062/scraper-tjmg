/**
 * Script principal que integra os scrapers do TJMG e do PJE
 */
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { scrapeTJMG } = require('./tjmg-scraper');
const { scrapePJE } = require('./pje-scraper');
const { writeJsonFile, readJsonFile } = require('./utils');
const fs = require('fs-extra');
let config = require('./config');

/**
 * Formata os dados combinados no formato especificado pelo usuário
 * @param {Array} data - Dados combinados do TJMG e PJE
 * @returns {Array} - Dados formatados
 */
const formatData = (data) => {
  return data.map(item => {
    // Encontra o primeiro autor (requerente) nas informações das partes
    const author = item.partyInfo && item.partyInfo.length > 0
      ? item.partyInfo.find(p => p.role === 'REQUERENTE') || item.partyInfo[0]
      : null;

    // Cria o objeto formatado
    const formattedItem = {
      "Credor Principal:": item.credor || '',
      "Número e Natureza do Precatório:": `Precatório nº ${item.codigo} - ${item.natureza}`,
      "Ano de Vencimento:": item.ano || '',
      "Situação:": item.status || '',
      "Valor de formação do Precatório (Valor de Face):": '', // Não temos essa informação nos dados extraídos
      "Data da última atualização do Valor de Face (Data de Liquidação):": '', // Não temos essa informação nos dados extraídos
      "Protocolo (Data/Hora):": item.data_protocolo ? `${item.data_protocolo}` : '',
      "Protocolo (Número/Ano):": '', // Não temos essa informação nos dados extraídos
      "Processo de Execução nº:": item.numero || '',
      "Processo SEI nº:": '', // Não temos essa informação nos dados extraídos
      "Origem:": '', // Não temos essa informação nos dados extraídos
      "Ação:": '', // Não temos essa informação nos dados extraídos
      "processed": true
    };

    // Adiciona informações do autor, se disponíveis
    if (author) {
      formattedItem.name = author.name.replace(/ \(REQUERENTE\)$/, '');
      formattedItem.role = author.role.replace(' (REQUERENTE)', ''); // Remove o '(REQUERENTE)' do role
      formattedItem.lawyers = author.lawyers;
    }

    return formattedItem;
  });
}

/**
 * Função principal que executa o fluxo completo de scraping
 */
const runScraping = async (config) => {
  try {
    console.log('Iniciando o processo de scraping...');

    // Executa o scraping do TJMG
    console.log('Etapa 1: Scraping do TJMG');
    const tjmgData = await scrapeTJMG(config);

    if (!tjmgData || tjmgData.length === 0) {
      console.error('Não foram encontrados dados no TJMG. Encerrando o processo.');
 return;
    }

    // Caminho do arquivo com os dados do TJMG
    const tjmgFile = path.join(
      config.outputDir,
      `tjmg_${config.consulta.entidade.replace(/\s+/g, '_')}_${config.consulta.anoInicio}-${config.consulta.anoFim}.json`
    );

    // Executa o scraping do PJE
    console.log('Etapa 2: Scraping do PJE');
    const combinedData = await scrapePJE(tjmgFile);

    if (!combinedData || combinedData.length === 0) {
      console.error('Não foi possível combinar os dados do TJMG e PJE. Encerrando o processo.');
 return;
    }

    // Formata os dados no formato especificado
    console.log('Etapa 3: Formatando os dados');
    const formattedData = formatData(combinedData);

    // Salva os dados formatados
    const outputFile = path.join(
      config.outputDir,
      `formatted_${config.consulta.entidade.replace(/\s+/g, '_')}_${config.consulta.anoInicio}-${config.consulta.anoFim}.json`
    );

    await writeJsonFile(outputFile, formattedData);
    console.log(`Dados formatados salvos em ${outputFile}`);

    console.log('Processo de scraping concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante o processo de scraping:', error);
  }
}

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', async (req, res) => {
  try {
    // Lista os arquivos JSON no diretório de saída
    const outputDir = config.outputDir || path.join(__dirname, 'output');
    await fs.ensureDir(outputDir);
    const files = await fs.readdir(outputDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    res.render('configForm', { 
      config,
      jsonFiles 
    });
  } catch (error) {
    console.error('Erro ao listar arquivos JSON:', error);
    res.render('configForm', { 
      config,
      jsonFiles: [] 
    });
  }
});

app.post('/scrape', async (req, res) => {
  const formConfig = req.body;
  // Atualiza o objeto de configuração global com os dados do formulário
  Object.assign(config.consulta, formConfig);
  console.log('Configuração atualizada:', config);

  // Inicia o scraping em background
  process.nextTick(() => runScraping(config));

  res.send('Scraping iniciado em background. Verifique o console para o progresso.');
});

app.post('/save', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.js');
    // Lemos a versão atual para não sobrescrever configurações não editadas pelo formulário
    delete require.cache[require.resolve(configPath)];
    const configFile = require(configPath);

    // Atualizamos as configurações com base nos dados do formulário.
    configFile.consulta.entidade = req.body.entidade;
    configFile.consulta.anoInicio = req.body.anoInicio;
    configFile.consulta.anoFim = req.body.anoFim;
    configFile.consulta.ocultarFechados = req.body.ocultarFechados === 'on';
    configFile.consulta.maxPages = parseInt(req.body.maxPages, 10);
    configFile.browser.headless = req.body.headless === 'on';

    // Convertemos o objeto de configuração de volta para uma string JavaScript
    const configString = `/**\n * Arquivo de configuração para o scraper\n */\n\nconst path = require('path');\n\nmodule.exports = ${JSON.stringify(configFile, null, 2)};\n`;

    require('fs').writeFile(configPath, configString, 'utf8', (err) => {
      if (err) {
        console.error("Erro ao escrever config.js:", err);
        res.status(500).send('Erro ao salvar configurações.');
        return;
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error("Erro ao salvar configurações:", err);
    res.status(500).send('Erro ao salvar configurações.');
  }
});

// Adiciona rota para download dos arquivos
app.get('/download/:filename', async (req, res) => {
  try {
    const filePath = path.join(config.outputDir, req.params.filename);
    res.download(filePath);
  } catch (error) {
    console.error('Erro ao fazer download do arquivo:', error);
    res.status(404).send('Arquivo não encontrado');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
