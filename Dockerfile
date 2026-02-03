# Dockerfile untuk Railway Worker
# Multi-stage build untuk optimize image size

FROM node:18-alpine AS base

# Install Python, gcc, make untuk compile native dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    make \
    libc-dev

# Install pnpm globally
RUN npm install -g pnpm@latest

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Expose port (Railway akan set PORT via env var)
EXPOSE 3001

# Start server
CMD ["node", "server.js"]
