const express = require('express');
const fs = require('fs');
const path = require('path');

const { exec } = require('child_process'); // Importar child_process

const app = express();
const port = 3000; // Porta que a aplicação web rodará
const outputDir = path.join(__dirname, 'output'); // Definir o diretório de saída
const configPath = path.join(__dirname, 'config.js');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Para servir arquivos estáticos como CSS ou JS no futuro
app.set('view engine', 'ejs'); // Usaremos EJS para renderizar o HTML facilmente
app.set('views', path.join(__dirname, 'views')); // Onde os arquivos EJS ficarão

// Rota para exibir o formulário de configuração
app.get('/', (req, res) => {
  try {
    // Usamos require para obter o objeto de configuração.
    // Limpamos o cache do require para garantir que sempre lemos a versão mais recente do arquivo.
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);

    // Adicionar listagem de arquivos JSON na pasta output
 fs.readdir(outputDir, (err, files) => {
 const jsonFiles = files ? files.filter(file => file.endsWith('.json')) : [];
      res.render('configForm', { config, jsonFiles });
    });

  } catch (err) {
    console.error("Erro ao ler ou parsear config.js:", err);
    res.status(500).send('Erro ao carregar configurações.');
  }
});

// Rota para salvar as configurações
app.post('/save', (req, res) => {
  try {
    // Lemos a versão atual para não sobrescrever configurações não editadas pelo formulário
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);

    // Atualizamos as configurações com base nos dados do formulário.
    // Precisamos ter cuidado com os tipos de dados (strings, numbers, booleans).
    config.consulta.entidade = req.body.entidade;
    config.consulta.anoInicio = req.body.anoInicio;
    config.consulta.anoFim = req.body.anoFim;
    config.consulta.ocultarFechados = req.body.ocultarFechados === 'on'; // Checkbox retorna 'on' ou undefined
    config.consulta.maxPages = parseInt(req.body.maxPages, 10); // Converter para número

    config.browser.headless = req.body.headless === 'on'; // Checkbox

    // Convertemos o objeto de configuração de volta para uma string JavaScript
    const configString = `/**
 * Arquivo de configuração para o scraper
 */

const path = require('path');

module.exports = ${JSON.stringify(config, null, 2)};
`; // Usamos JSON.stringify e ajustamos a formatação

    fs.writeFile(configPath, configString, 'utf8', (err) => {
    if (err) {
        console.error("Erro ao escrever config.js:", err);
        res.status(500).send('Erro ao salvar configurações.');
      return;
    }
      res.redirect('/'); // Redireciona de volta para a página principal após salvar
    });

  } catch (err) {
    console.error("Erro ao salvar configurações:", err);
    res.status(500).send('Erro ao salvar configurações.');
  }
});

// Nova rota para executar o scraper
app.post('/run-scraper', (req, res) => {
  // Em um ambiente real, você precisaria gerenciar execuções concorrentes
  // e talvez usar WebSockets para um feedback de progresso em tempo real.
 exec('npm start', (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao executar scraper: ${error.message}`);
      res.status(500).json({ status: 'error', message: error.message });
      return;
    }
    if (stderr) {
      console.error(`Erro do scraper: ${stderr}`);
      res.status(500).json({ status: 'error', message: stderr });
      return;
    }
    console.log(`Saída do scraper: ${stdout}`);
    res.json({ status: 'success', message: 'Scraper executado com sucesso!', output: stdout });
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
