FROM node:22-slim

# Chromium dependencies for @sparticuz/chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080
# Render usa porta 10000 — definido via env var
# Render persistent disk em /var/data — Fly.io usa /data
ENV DB_PATH=/var/data/eneagrama.db

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies (chromium + puppeteer-core)
RUN npm install --omit=dev

# Copy the rest of the application
COPY . ./

# Cria diretórios pra volumes persistentes (Fly.io: /data, Render: /var/data)
# O app pode iniciar antes do volume ser montado.
RUN mkdir -p /data /var/data

EXPOSE 8080
# Render expõe 10000 por padrão
EXPOSE 10000

CMD ["node", "server.js"]
