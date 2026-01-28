# 🐳 LX Music Web - Docker 部署完整指南

本文档提供完整的 Docker 部署方案,支持从 GitHub 直接构建和运行。

---

## 📋 前置要求

### 必需
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ 可用内存
- 10GB+ 可用磁盘空间

### 可选
- Git (从 GitHub 克隆代码)
- curl (测试 API)

---

## 🚀 快速开始

### 方式一: 一键测试脚本 (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/lx-music-web.git
cd lx-music-web

# 2. 运行测试脚本
./test-docker.sh
```

**脚本会自动**:
- ✅ 检查 Docker 环境
- ✅ 构建 Docker 镜像
- ✅ 启动容器
- ✅ 运行健康检查
- ✅ 测试核心 API
- ✅ 显示访问地址

### 方式二: 手动部署

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/lx-music-web.git
cd lx-music-web

# 2. 复制环境变量文件
cp .env.example .env

# 3. 修改配置 (可选)
nano .env

# 4. 构建并启动
docker-compose up -d

# 5. 查看日志
docker-compose logs -f

# 6. 访问
# http://localhost:3000
```

---

## 🔧 配置说明

### 环境变量

编辑 `.env` 文件:

```env
# JWT 密钥 (生产环境必须修改!)
JWT_SECRET=your-super-secret-key-here

# 端口设置
PORT=3000

# 下载配置
MAX_CONCURRENT_DOWNLOADS=3

# 时区
TZ=Asia/Shanghai
```

### Docker Compose 配置

#### 使用本地目录挂载

编辑 `docker-compose.yml`:

```yaml
volumes:
  # 改为本地目录挂载
  - ./data:/app/data
  - ./music:/app/music
```

#### 修改端口

```yaml
ports:
  - "8080:3000"  # 使用 8080 端口
```

#### 资源限制

```yaml
deploy:
  resources:
    limits:
      memory: 2G      # 最大内存
      cpus: '2.0'     # 最大 CPU
    reservations:
      memory: 512M    # 保留内存
      cpus: '0.5'     # 保留 CPU
```

---

## 📦 构建选项

### 从源码构建

```bash
# 默认构建
docker-compose build

# 无缓存构建 (推荐首次构建)
docker-compose build --no-cache

# 并行构建
docker-compose build --parallel
```

### 从 GitHub 直接构建

```bash
# 使用 GitHub 仓库 URL
docker build -t lx-music-web:latest \
  https://github.com/your-repo/lx-music-web.git
```

### 使用 Docker Buildx (支持多平台)

```bash
# 创建 builder
docker buildx create --name mybuilder --use

# 构建多平台镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t lx-music-web:latest \
  --push \
  .
```

---

## 🎯 部署场景

### 场景一: 本地开发测试

```bash
# 使用开发配置
docker-compose -f docker-compose.dev.yml up

# 特点:
# - 挂载源码目录
# - 开启详细日志
# - 无资源限制
```

### 场景二: 生产环境

```bash
# 使用生产配置
docker-compose up -d

# 特点:
# - 优化的镜像大小
# - 资源限制
# - 健康检查
# - 自动重启
```

### 场景三: 高可用部署

使用 Docker Swarm 或 Kubernetes:

```bash
# Docker Swarm
docker stack deploy -c docker-compose.yml lx-music

# Kubernetes
# 需要转换为 k8s 配置
```

---

## 🔍 健康检查

### 内置健康检查

Docker 容器内置健康检查:

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' lx-music-web

# 查看健康检查日志
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' lx-music-web
```

### 手动测试

```bash
# 健康检查端点
curl http://localhost:3000/health

# 预期响应
{
  "status": "ok",
  "timestamp": 1706428800000,
  "uptime": 120.5
}
```

---

## 📊 监控与日志

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f lx-music-web

# 最近 100 行
docker-compose logs --tail=100

# 带时间戳
docker-compose logs -f --timestamps
```

### 容器统计

```bash
# 实时资源使用
docker stats lx-music-web

# 容器详情
docker inspect lx-music-web

# 容器进程
docker top lx-music-web
```

### 日志配置

在 `docker-compose.yml` 中配置日志:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 🔄 更新与升级

### 更新代码

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 重启容器
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

### 数据备份

```bash
# 备份数据目录
docker run --rm \
  -v lx-music-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz /data

# 备份音乐目录
docker run --rm \
  -v lx-music-files:/music \
  -v $(pwd):/backup \
  alpine tar czf /backup/music-backup-$(date +%Y%m%d).tar.gz /music
```

### 恢复数据

```bash
# 恢复数据
docker run --rm \
  -v lx-music-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/data-backup-20240128.tar.gz -C /
```

---

## 🐛 故障排除

### 问题 1: 容器无法启动

**症状**: `docker-compose up` 失败

**解决方案**:

```bash
# 查看详细错误
docker-compose up

# 检查端口占用
lsof -i :3000

# 查看容器日志
docker-compose logs

# 重置容器
docker-compose down -v
docker-compose up -d
```

### 问题 2: 构建失败

**症状**: 镜像构建错误

**解决方案**:

```bash
# 清理 Docker 缓存
docker builder prune -af

# 重新构建
docker-compose build --no-cache

# 检查磁盘空间
df -h

# 清理未使用的镜像
docker image prune -a
```

### 问题 3: 健康检查失败

**症状**: 容器状态为 unhealthy

**解决方案**:

```bash
# 查看健康检查日志
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' lx-music-web

# 进入容器检查
docker exec -it lx-music-web sh

# 手动测试健康端点
curl http://localhost:3000/health

# 查看应用日志
docker-compose logs -f
```

### 问题 4: 数据丢失

**症状**: 重启后数据消失

**解决方案**:

```bash
# 检查 volume 配置
docker volume ls

# 查看 volume 详情
docker volume inspect lx-music-data

# 使用本地目录挂载
# 编辑 docker-compose.yml:
volumes:
  - ./data:/app/data
  - ./music:/app/music
```

### 问题 5: 网络问题

**症状**: 容器无法访问外网

**解决方案**:

```bash
# 检查 DNS
docker exec lx-music-web cat /etc/resolv.conf

# 测试网络
docker exec lx-music-web ping -c 3 baidu.com

# 重建网络
docker-compose down
docker network prune
docker-compose up -d

# 配置代理
# 在 docker-compose.yml 中:
environment:
  - HTTP_PROXY=http://proxy:8080
  - HTTPS_PROXY=http://proxy:8080
```

---

## 🔐 安全建议

### 生产环境必做

1. **修改 JWT 密钥**
   ```bash
   # 生成随机密钥
   openssl rand -base64 32
   
   # 设置到 .env
   JWT_SECRET=<生成的密钥>
   ```

2. **使用非 root 用户**
   ```dockerfile
   # Dockerfile 已配置
   USER node
   ```

3. **限制资源**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1G
         cpus: '1.0'
   ```

4. **启用 HTTPS**
   使用 Nginx 或 Traefik 作为反向代理:
   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:3000;
       }
   }
   ```

5. **定期备份**
   ```bash
   # 添加到 crontab
   0 2 * * * /path/to/backup-script.sh
   ```

---

## 📈 性能优化

### 镜像优化

已实现的优化:
- ✅ 多阶段构建 (减小镜像大小)
- ✅ Alpine 基础镜像
- ✅ npm ci (更快的依赖安装)
- ✅ 构建缓存
- ✅ 非 root 用户

### 运行时优化

```yaml
# docker-compose.yml
environment:
  # Node.js 性能优化
  - NODE_OPTIONS=--max-old-space-size=512

deploy:
  # 资源预留
  resources:
    reservations:
      memory: 512M
```

### 网络优化

```yaml
networks:
  lx-music-network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1500
```

---

## 🧪 测试清单

部署后请检查:

- [ ] 健康检查通过 (`/health` 返回 200)
- [ ] 前端可访问 (`http://localhost:3000`)
- [ ] 用户注册/登录正常
- [ ] 音源上传功能正常
- [ ] 搜索功能正常
- [ ] 下载功能正常
- [ ] 数据持久化正常 (重启后数据还在)
- [ ] 日志输出正常
- [ ] 资源使用在合理范围内

---

## 📞 获取帮助

- **GitHub Issues**: 提交问题
- **文档**: 查看其他 markdown 文档
- **日志**: `docker-compose logs -f`

---

## 📄 相关文件

- `Dockerfile` - Docker 镜像构建配置
- `docker-compose.yml` - 生产环境配置
- `docker-compose.dev.yml` - 开发环境配置
- `.env.example` - 环境变量模板
- `.dockerignore` - Docker 构建忽略文件
- `test-docker.sh` - 快速测试脚本

---

**祝部署顺利! 🎉**

如有问题请查看故障排除部分或提交 Issue。
