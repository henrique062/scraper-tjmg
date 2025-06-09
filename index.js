/**
 * Script principal que integra os scrapers do TJMG e do PJE
 */
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { scrapeTJMG } = require('./tjmg-scraper');
const { scrapePJE } = require('./pje-scraper');
const { writeJsonFile, readJsonFile } = require('./utils');
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

app.get('/', (req, res) => {
  res.render('configForm', { config });
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

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
