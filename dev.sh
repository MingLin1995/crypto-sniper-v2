#!/bin/bash

# 開發環境啟動腳本

echo "Starting development environment..."

# 確保 .env 檔案存在
if [ ! -f .env ]; then
    echo ".env file not found. Creating from .env.example..."
    cp .env.example .env
    echo ".env file created. You can edit it later if needed."
    echo ""
fi

# 停止舊的容器
echo "Stopping old containers..."
docker compose -f docker-compose.dev.yml down

# 建置並啟動
echo "Building and starting containers..."
docker compose -f docker-compose.dev.yml up --build
