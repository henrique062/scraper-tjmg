const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000; // Porta que a aplicação web rodará

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

    res.render('configForm', { config }); // Renderiza o formulário com os dados do config
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
      res.send('Configurações salvas com sucesso!');
    });

  } catch (err) {
    console.error("Erro ao salvar configurações:", err);
    res.status(500).send('Erro ao salvar configurações.');
  }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
