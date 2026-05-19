FROM node:22-alpine
WORKDIR /app

# Instala as dependências (incluindo devDependencies necessárias para o build e tsx)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o resto do código
COPY . .

# Variáveis de ambiente de build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Faz o build do Next.js
RUN npm run build

# Expõe a porta 3000
EXPOSE 3000

# Executa as migrations antes de subir o servidor
CMD npm run db:migrate && npm start
