FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm run install:all

# Copy source files
COPY . .

# Build client and server
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
