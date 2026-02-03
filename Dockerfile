# Dockerfile untuk Railway Worker
# Menggunakan Debian base image untuk kompatibilitas Playwright yang lebih baik

FROM node:18-slim

# Install build dependencies dan Playwright system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    gcc \
    g++ \
    make \
    libc6-dev \
    # Playwright dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@latest

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Install Playwright browsers dengan dependencies
RUN pnpm playwright install --with-deps chromium

# Copy application code
COPY . .

# Expose port (Railway akan set PORT via env var, tapi kita expose 3001 sebagai default)
EXPOSE 3001

# Start server
CMD ["node", "server.js"]
