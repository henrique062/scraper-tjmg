# Usa uma imagem base oficial do Node.js
FROM node:18

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos package.json e package-lock.json (ou npm-shrinkwrap.json)
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o restante dos arquivos da aplicação para o diretório de trabalho
COPY . .

# Expõe a porta em que a aplicação roda (verifique a porta no seu Extração Precatório.js)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "node", "Extração Precatório.js" ]