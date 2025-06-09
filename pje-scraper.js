/**
 * Script para fazer web scraping do site do PJE
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const { randomDelay, applyProcessMask, readJsonFile, writeJsonFile } = require('./utils');

// Adiciona o plugin stealth para evitar detecção
puppeteer.use(StealthPlugin());

/**
 * Extrai informações das partes do processo
 * @param {Page} page - Instância da página do Puppeteer
 * @returns {Promise<Array>} - Array com as informações das partes
 */
async function extractPartyInfo(page) {
  try {
    await page.waitForSelector(config.selectors.pje.partyInfoTable, { timeout: 10000 });
    
    const partyInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#j_id134\\:processoPartesPoloAtivoResumidoList\\:tb tr'));
      
      const parties = [];
      let currentAuthor = null;
      
      rows.forEach((row) => {
        const nameElement = row.querySelector('span.text-bold') || 
                           row.querySelector('span.text-muted') || 
                           row.querySelector('span');
        
        if (!nameElement) return;
        
        const nameText = nameElement.textContent.trim();
        
        const nameMatch = nameText.match(/^(.*?)(?: -|$)/);
        const cpfMatch = nameText.match(/CPF:\s*([\d.-]+)/);
        const roleMatch = nameText.match(/\((.*?)\)/);
        const oabMatch = nameText.match(/OAB\s*([A-Z]{2}\d+)/);
        
        const name = nameMatch ? nameMatch[1].trim() : '';
        const cpf = cpfMatch ? cpfMatch[1].trim() : '';
        const role = roleMatch ? roleMatch[1].trim() : '';
        const oab = oabMatch ? oabMatch[1].trim() : '';
        
        if (role !== 'ADVOGADO') {
          currentAuthor = {
            name: name,
            cpf: cpf,
            role: role,
            lawyers: ''
          };
          parties.push(currentAuthor);
        } else if (role === 'ADVOGADO' && currentAuthor) {
          const lawyerInfo = `${name} (CPF: ${cpf}, OAB: ${oab})`;
          currentAuthor.lawyers += currentAuthor.lawyers ? `; ${lawyerInfo}` : lawyerInfo;
        }
      });
      
      return parties;
    });
    
    return partyInfo;
  } catch (error) {
    console.error('Erro ao extrair informações das partes:', error.message);
    return [];
  }
}

/**
 * Busca informações de um processo no PJE
 * @param {Page} page - Instância da página do Puppeteer
 * @param {Browser} browser - Instância do navegador do Puppeteer
 * @param {string} numeroProcesso - Número do processo a ser consultado
 * @returns {Promise<Object>} - Objeto com as informações do processo
 */
async function searchProcesso(page, browser, numeroProcesso) {
  console.log(`Consultando processo ${numeroProcesso} no PJE`);
  
  try {
    // Navega para a página de consulta
    await page.goto(config.urls.pje, { waitUntil: 'networkidle2' });
    
    // Preenche o campo de número do processo
    await page.waitForSelector(config.selectors.pje.processoInput);
    await page.type(
      config.selectors.pje.processoInput,
      applyProcessMask(numeroProcesso),
      {
        delay: Math.random() * 
          (config.humanBehavior.typeSpeed.max - config.humanBehavior.typeSpeed.min) + 
          config.humanBehavior.typeSpeed.min
      }
    );
    
    // Pressiona Enter para realizar a consulta
    await page.keyboard.press('Enter');
    await randomDelay(2000, 4000);
    
    // Verifica se encontrou resultados
    try {
      await page.waitForSelector(config.selectors.pje.verDetalhesLink, { timeout: 10000 });
    } catch (error) {
      console.log(`Processo ${numeroProcesso} não encontrado no PJE`);
      return null;
    }
    
    // Abre os detalhes do processo em uma nova aba
    const newPage = await browser.newPage();
    
    try {
      // Configura user agent
      await newPage.setUserAgent(config.browser.userAgent);
      
      // Configura timeout
      await newPage.setDefaultNavigationTimeout(config.browser.timeout);
      
      // Obtém o link para os detalhes do processo
      const href = await page.$eval(config.selectors.pje.verDetalhesLink, (el) => el.getAttribute('onclick'));
      const url = href.match(/'([^']+\.seam[^']+)'/)[1];
      
      // Navega para a página de detalhes
      await newPage.goto(`https://pje-consulta-publica.tjmg.jus.br${url}`, { waitUntil: 'networkidle2' });
      
      // Extrai as informações das partes
      const partyInfo = await extractPartyInfo(newPage);
      
      // Fecha a nova aba
      await newPage.close();
      
      return partyInfo;
    } catch (error) {
      console.error(`Erro ao processar detalhes do processo ${numeroProcesso}:`, error.message);
      
      if (!newPage.isClosed()) {
        await newPage.close();
      }
      
      return null;
    }
  } catch (error) {
    console.error(`Erro ao consultar processo ${numeroProcesso}:`, error.message);
    return null;
  }
}

/**
 * Processa os dados do TJMG para extrair informações adicionais do PJE
 * @param {string} inputFile - Caminho do arquivo JSON com os dados do TJMG
 * @returns {Promise<Array>} - Array com os dados combinados
 */
async function scrapePJE(inputFile) {
  console.log('Iniciando scraping do PJE...');
  
  // Lê os dados do TJMG
  const jsonData = await readJsonFile(inputFile);
  
  if (!jsonData || !Array.isArray(jsonData)) {
    console.error('Falha ao carregar dados do TJMG. Verifique o arquivo de entrada.');
    return [];
  }
  
  console.log(`Carregados ${jsonData.length} registros do TJMG`);
  
  // Inicia o navegador
  const browser = await puppeteer.launch({
    headless: config.browser.headless,
    defaultViewport: { 
      width: config.browser.width, 
      height: config.browser.height 
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // Configura user agent
    await page.setUserAgent(config.browser.userAgent);
    
    // Configura timeout
    await page.setDefaultNavigationTimeout(config.browser.timeout);
    
    // Processa cada registro
    let processedCount = 0;
    const outputFile = path.join(
      config.outputDir, 
      `combined_${path.basename(inputFile)}`
    );
    
    // Para fins de teste, limita o número de registros a serem processados
    const maxRecords = 2; // Processa apenas 2 registros para teste
    
    for (const row of jsonData) {
      // Pula registros já processados
      if (row.pje_processed) {
        console.log(`Registro ${row.numero} já processado. Pulando...`);
        continue;
      }
      
      // Extrai informações do PJE usando o número do processo de execução
      const partyInfo = await searchProcesso(page, browser, row.numero);
      
      // Marca o registro como processado
      row.pje_processed = true;
      
      // Adiciona as informações do PJE ao registro
      if (partyInfo && partyInfo.length > 0) {
        row.partyInfo = partyInfo;
        console.log(`Informações do processo de execução ${row.numero} extraídas com sucesso`);
      } else {
        row.partyInfo = [];
        console.log(`Não foi possível extrair informações do processo de execução ${row.numero}`);
      }
      
      // Salva os dados atualizados
      await writeJsonFile(outputFile, jsonData);
      
      // Incrementa o contador de registros processados
      processedCount++;
      
      // Para fins de teste, limita o número de registros a serem processados
      if (processedCount >= maxRecords) {
        console.log(`Limite de ${maxRecords} registros atingido. Interrompendo processamento.`);
        break;
      }
      
      // Aguarda um tempo antes de processar o próximo registro
      await randomDelay(2000, 5000);
    }
    
    console.log(`Total de ${processedCount} registros processados`);
    console.log(`Dados salvos em ${outputFile}`);
    
    return jsonData;
  } catch (error) {
    console.error('Erro durante o scraping do PJE:', error);
    return [];
  } finally {
    // Fecha o navegador
    await browser.close();
  }
}

// Exporta a função para uso em outros arquivos
module.exports = { scrapePJE };

// Se este arquivo for executado diretamente
if (require.main === module) {
  // Verifica se foi fornecido um arquivo de entrada
  const inputFile = process.argv[2] || path.join(
    config.outputDir, 
    `tjmg_${config.consulta.entidade.replace(/\s+/g, '_')}_${config.consulta.anoInicio}-${config.consulta.anoFim}.json`
  );
  
  scrapePJE(inputFile)
    .then(() => console.log('Scraping do PJE concluído'))
    .catch(error => console.error('Erro:', error));
}

