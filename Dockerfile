FROM node:22-alpine
WORKDIR /app

# Instala as dependências (incluindo devDependencies necessárias para o build e tsx)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o resto do código
COPY . .

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Aceita as variáveis do Easypanel durante o build
ARG DATABASE_URL
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG RESEND_API_KEY
ARG RESEND_FROM

ENV DATABASE_URL=$DATABASE_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV RESEND_FROM=$RESEND_FROM

# Faz o build do Next.js
RUN npm run build

# Expõe a porta 3000
EXPOSE 3000

# Executa as migrations antes de subir o servidor
CMD npm run db:migrate && npm start
