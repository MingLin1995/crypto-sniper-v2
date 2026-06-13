#!/bin/bash
set -e

# 生產環境部署腳本

echo "Deploying to production..."

# 確保 .env 檔案存在
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env file before deploying to production."
    exit 1
fi

# 停止舊的容器
echo "Stopping old containers..."
docker compose -f docker-compose.prod.yml down

# 建置並啟動
echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 等待服務啟動
echo "Waiting for services to start..."
sleep 5

# 檢查服務狀態
echo "Service status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Deployment completed!"
echo "Check logs with: docker compose -f docker-compose.prod.yml logs -f app"