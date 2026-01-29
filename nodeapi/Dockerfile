# --- Stage 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm ci

# --- Stage 2: Production ---
FROM node:18-alpine

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# User setup
USER node

EXPOSE 3000
CMD ["node", "src/index.js"]
