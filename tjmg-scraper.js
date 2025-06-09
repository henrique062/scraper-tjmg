/**
 * Script para fazer web scraping do site do TJMG
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const { randomDelay, writeJsonFile } = require('./utils');

// Adiciona o plugin stealth para evitar detecção
puppeteer.use(StealthPlugin());

/**
 * Função principal para extrair dados do site do TJMG
 * @returns {Promise<Array>} - Array com os dados extraídos
 */
async function scrapeTJMG() {
  console.log('Iniciando scraping do TJMG...');
  
  // Cria diretório de saída se não existir
  await fs.mkdir(config.outputDir, { recursive: true });
  
  // Inicia o navegador
  const browser = await puppeteer.launch({
    headless: config.browser.headless,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
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
  let allTableData = [];
  
  try {
    // Configura user agent
    await page.setUserAgent(config.browser.userAgent);
    
    // Configura timeout
    await page.setDefaultNavigationTimeout(config.browser.timeout);
    
    // Navega para a URL
    console.log(`Navegando para ${config.urls.tjmg}`);
    await page.goto(config.urls.tjmg, { waitUntil: 'networkidle2' });
    
    // Preenche o campo de entidade devedora
    console.log(`Preenchendo campo de Entidade Devedora: ${config.consulta.entidade}`);
    await page.waitForSelector(config.selectors.tjmg.entidadeInput);
    await page.type(config.selectors.tjmg.entidadeInput, config.consulta.entidade, {
      delay: Math.random() * 
        (config.humanBehavior.typeSpeed.max - config.humanBehavior.typeSpeed.min) + 
        config.humanBehavior.typeSpeed.min
    });
    
    // Espera pela sugestão e clica nela
    try {
      console.log('Aguardando sugestões...');
      await page.waitForSelector(config.selectors.tjmg.entidadeSuggestion, { timeout: 5000 });
      await randomDelay(500, 1000);
      await page.keyboard.press('Enter');
      await randomDelay(1000, 2000);
    } catch (error) {
      console.log('Não foi possível encontrar sugestões, continuando...');
    }
    
    /*// Preenche os campos de ano
    if (config.consulta.anoInicio) {
      console.log(`Preenchendo campo de Ano Início: ${config.consulta.anoInicio}`);
      await page.type(config.selectors.tjmg.anoInicioInput, config.consulta.anoInicio, {
        delay: Math.random() * 
          (config.humanBehavior.typeSpeed.max - config.humanBehavior.typeSpeed.min) + 
          config.humanBehavior.typeSpeed.min
      });
      await randomDelay(500, 1000);
    }
    
    if (config.consulta.anoFim) {
      console.log(`Preenchendo campo de Ano Fim: ${config.consulta.anoFim}`);
      await page.type(config.selectors.tjmg.anoFimInput, config.consulta.anoFim, {
        delay: Math.random() * 
          (config.humanBehavior.typeSpeed.max - config.humanBehavior.typeSpeed.min) + 
          config.humanBehavior.typeSpeed.min
      });
      await randomDelay(500, 1000);
    }*/
    
      if (config.consulta.anoInicio) {
        console.log(`Preenchendo campo de Ano Início: ${config.consulta.anoInicio}`);
        
        // Define o valor diretamente via JavaScript
        await page.evaluate((selector, value) => {
          const input = document.querySelector(selector);
          input.value = value;
          
          // Dispara eventos para garantir que o site reconheça a mudança
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }, config.selectors.tjmg.anoInicioInput, config.consulta.anoInicio);
        
        await randomDelay(800, 1200);
      }

      if (config.consulta.anoFim) {
        console.log(`Preenchendo campo de Ano Início: ${config.consulta.anoFim}`);
        
        // Define o valor diretamente via JavaScript
        await page.evaluate((selector, value) => {
          const input = document.querySelector(selector);
          input.value = value;
          
          // Dispara eventos para garantir que o site reconheça a mudança
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }, config.selectors.tjmg.anoFimInput, config.consulta.anoFim);
        
        await randomDelay(800, 1200);
      }
      


    // Clica no botão Consultar
    console.log('Clicando no botão Consultar');
    await page.keyboard.press('Enter');
    await randomDelay(2000, 4000);
    
    // Verifica se há resultados
    try {
      await page.waitForSelector(config.selectors.tjmg.resultTable, { timeout: 10000 });
    } catch (error) {
      console.log('Não foram encontrados resultados para a consulta');
      await browser.close();
      return [];
    }
    
    // Verifica se há paginação
    let currentPage = 1;
    let totalPages = 1;
    
    try {
      await page.waitForSelector(config.selectors.tjmg.paginatorCurrent, { timeout: 5000 });
      const paginationInfo = await page.evaluate((selector) => {
        const paginatorText = document.querySelector(selector).textContent;
        const match = paginatorText.match(/Página (\d+) de (\d+)/);
        if (match) {
          const [_, currentPage, totalPages] = match.map(Number);
          return { currentPage, totalPages };
        } else {
          return { currentPage: 1, totalPages: 1 };
        }
      }, config.selectors.tjmg.paginatorCurrent);
      
      currentPage = paginationInfo.currentPage;
      totalPages = paginationInfo.totalPages;
      
      console.log(`Encontradas ${totalPages} páginas de resultados`);
    } catch (error) {
      console.log('Não foi possível determinar o número de páginas, assumindo página única');
    }
    
    // Extrai os dados de todas as páginas
    while (currentPage <= totalPages) {
      console.log(`Extraindo dados da página ${currentPage} de ${totalPages}`);
      
      const tableData = await page.evaluate((columns) => {
        const rows = Array.from(document.querySelectorAll('#resultado_data tr'));
        let extractedData = [];
        
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length === columns.length) {
            const obj = {};
            columns.forEach((col, idx) => {
              if (col !== 'empty') {
                obj[col] = cells[idx].textContent.trim();
              }
            });
            
            obj.pje_processed = false;
            obj.assertiva_processed = false;
            
            extractedData.push(obj);
          }
        }
        
        return extractedData;
      }, config.columns);
      
      allTableData = allTableData.concat(tableData);
      
      // Verifica se atingiu o limite de páginas (para testes)
      if (config.consulta.maxPages && currentPage >= config.consulta.maxPages) {
        console.log(`Limite de ${config.consulta.maxPages} páginas atingido. Interrompendo extração.`);
        break;
      }
      
      // Verifica se há mais páginas
      if (currentPage < totalPages) {
        console.log('Navegando para a próxima página');
        
        await page.evaluate((selector) => {
          document.querySelector(selector).click();
        }, config.selectors.tjmg.nextPageButton);
        
        // Espera o indicador de carregamento desaparecer
        try {
          await page.waitForSelector(config.selectors.tjmg.loadingIndicator, {
            hidden: true,
            timeout: 30000
          });
        } catch (error) {
          console.log('Timeout ao esperar o indicador de carregamento desaparecer');
        }
        
        // Espera a tabela de resultados aparecer novamente
        await page.waitForSelector(config.selectors.tjmg.resultTable);
        await randomDelay(1000, 2000);
        
        // Atualiza o número da página atual
        currentPage++;
      } else {
        break;
      }
    }
    
    console.log(`Total de ${allTableData.length} registros extraídos do TJMG`);
    
    // Salva os dados em um arquivo JSON
    const outputFile = path.join(
      config.outputDir, 
      `tjmg_${config.consulta.entidade.replace(/\s+/g, '_')}_${config.consulta.anoInicio}-${config.consulta.anoFim}.json`
    );
    
    await writeJsonFile(outputFile, allTableData);
    console.log(`Dados salvos em ${outputFile}`);
    
    return allTableData;
  } catch (error) {
    console.error('Erro durante o scraping do TJMG:', error);
    return [];
  } finally {
    // Fecha o navegador
    await browser.close();
  }
}

// Exporta a função para uso em outros arquivos
module.exports = { scrapeTJMG };

// Se este arquivo for executado diretamente
if (require.main === module) {
  scrapeTJMG()
    .then(() => console.log('Scraping do TJMG concluído'))
    .catch(error => console.error('Erro:', error));
}

