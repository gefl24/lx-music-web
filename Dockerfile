# ===================================
# LX Music Web - Production Dockerfile
# 多阶段构建,优化镜像大小和构建速度
# ===================================

# ===================================
# Stage 1: Frontend Builder
# ===================================
FROM node:18-alpine AS frontend-builder

LABEL stage=frontend-builder

WORKDIR /build/client

# 只复制 package 文件以利用 Docker 缓存
COPY client/package.json client/package-lock.json* ./

# 安装前端依赖 (使用 install 以支持没有 lock 文件的情况)
RUN npm install --prefer-offline --no-audit || npm install --no-audit

# 复制前端源代码
COPY client/ ./

# 构建前端静态文件
RUN npm run build

# 验证构建产物
RUN ls -la dist/

# ===================================
# Stage 2: Backend Builder
# ===================================
FROM node:18-alpine AS backend-builder

LABEL stage=backend-builder

WORKDIR /build/server

# 复制 package 文件
COPY server/package.json server/package-lock.json* ./

# 安装生产依赖 (包含 better-sqlite3 需要编译)
# 使用 install 以支持没有 lock 文件的情况
RUN apk add --no-cache python3 make g++ \
    && npm install --only=production --prefer-offline --no-audit || npm install --only=production --no-audit \
    && apk del python3 make g++

# ===================================
# Stage 3: Runtime
# ===================================
FROM node:18-alpine

LABEL maintainer="lx-music-web" \
      description="LX Music Web - Docker化音乐服务" \
      version="2.0.0"

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    tzdata \
    tini \
    && rm -rf /var/cache/apk/*

# 复制后端依赖
COPY --from=backend-builder /build/server/node_modules ./node_modules

# 复制后端源代码
COPY server/src ./src
COPY server/index.js ./
COPY server/package.json ./

# 复制前端构建产物
COPY --from=frontend-builder /build/client/dist ./public

# 创建数据目录
RUN mkdir -p /app/data /app/music \
    && chown -R node:node /app

# 切换到非 root 用户
USER node

# 构建参数
ARG JWT_SECRET=please-change-this-in-production

# 环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    MUSIC_DIR=/app/music \
    JWT_SECRET=${JWT_SECRET}

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 tini 作为初始化进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "index.js"]
