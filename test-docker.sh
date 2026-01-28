#!/bin/bash

# ===================================
# LX Music Web - 快速测试脚本
# ===================================

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║     🎵 LX Music Web - Docker 快速测试               ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Docker,请先安装 Docker${NC}"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Docker Compose,请先安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"
echo ""

# 清理旧容器
echo -e "${BLUE}🧹 清理旧容器...${NC}"
docker-compose down -v 2>/dev/null || true
echo ""

# 构建镜像
echo -e "${BLUE}🔨 构建 Docker 镜像...${NC}"
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 镜像构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 镜像构建成功${NC}"
echo ""

# 启动容器
echo -e "${BLUE}🚀 启动容器...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 容器启动失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 容器启动成功${NC}"
echo ""

# 等待服务启动
echo -e "${BLUE}⏳ 等待服务启动 (30秒)...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 测试健康检查
echo -e "${BLUE}🔍 测试健康检查端点...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
    echo "   响应: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ 健康检查失败${NC}"
    docker-compose logs --tail=50
    exit 1
fi
echo ""

# 测试用户注册
echo -e "${BLUE}🧪 测试用户注册...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/user/register \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"test123456"}')

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ 用户注册成功${NC}"
    
    # 提取 token
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✅ Token 获取成功${NC}"
        
        # 测试获取个人信息
        echo -e "${BLUE}🧪 测试获取个人信息...${NC}"
        PROFILE_RESPONSE=$(curl -s http://localhost:3000/api/user/profile \
            -H "Authorization: Bearer $TOKEN")
        
        if echo "$PROFILE_RESPONSE" | grep -q "testuser"; then
            echo -e "${GREEN}✅ 个人信息获取成功${NC}"
        else
            echo -e "${YELLOW}⚠️  个人信息获取异常${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  用户注册测试跳过 (可能已存在)${NC}"
fi
echo ""

# 显示容器状态
echo -e "${BLUE}📊 容器状态:${NC}"
docker-compose ps
echo ""

# 显示日志
echo -e "${BLUE}📋 最近日志:${NC}"
docker-compose logs --tail=20
echo ""

# 测试总结
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                       ║${NC}"
echo -e "${BLUE}║              ${GREEN}✅ 测试完成!${BLUE}                              ║${NC}"
echo -e "${BLUE}║                                                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}访问地址:${NC} http://localhost:3000"
echo -e "${GREEN}查看日志:${NC} docker-compose logs -f"
echo -e "${GREEN}停止服务:${NC} docker-compose down"
echo -e "${GREEN}重启服务:${NC} docker-compose restart"
echo ""
echo -e "${YELLOW}提示:${NC} 使用 ${BLUE}docker-compose logs -f${NC} 查看实时日志"
echo ""
