FROM node:20-slim

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
ENV DB_PATH=/data/eneagrama.db

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies (chromium + puppeteer-core)
RUN npm install --omit=dev

# Copy the rest of the application
COPY . ./

# Fly.io will provide a volume mounted at /data for SQLite persistence.
# We create the directory so the app can start even before volume is mounted.
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "server.js"]
