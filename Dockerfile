# ===================================
# Stage 1: Build Frontend
# ===================================
FROM node:18-alpine AS frontend-builder

WORKDIR /build/client

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy client source
COPY client/ ./

# Build frontend
RUN npm run build

# ===================================
# Stage 2: Build Backend
# ===================================
FROM node:18-alpine AS backend-builder

WORKDIR /build/server

# Copy server package files
COPY server/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# ===================================
# Stage 3: Runtime
# ===================================
FROM node:18-alpine

LABEL maintainer="lx-music-web"
LABEL description="LX Music Web Server - Dockerized Music Service"

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Copy backend files
COPY --from=backend-builder /build/server/node_modules ./node_modules
COPY server/src ./src
COPY server/index.js ./
COPY server/package.json ./

# Copy frontend build
COPY --from=frontend-builder /build/client/dist ./public

# Create directories
RUN mkdir -p /app/data /app/music

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    MUSIC_DIR=/app/music

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]
