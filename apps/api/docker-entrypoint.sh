#!/bin/sh
set -e

echo "=== Starting application setup ==="

# ==================== 開發環境專用：安裝依賴 ====================
if [ "$NODE_ENV" = "development" ]; then
  # 檢查 node_modules 是否存在（volume 可能是空的）
  if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/prisma" ]; then
    echo "Installing dependencies (first time setup)..."
    if ! bun install; then
      echo "ERROR: Dependency installation failed"
      exit 1
    fi
    echo "Dependencies installed"
  else
    echo "Dependencies already installed"
  fi
fi

# ==================== 等待資料庫 ====================
echo "Waiting for database..."
RETRY_COUNT=0
MAX_RETRIES=30

while ! nc -z db 5432; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database connection timeout after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 1
done
echo "Database is ready!"

# ==================== Prisma 設定 ====================
# 開發環境專用：
if [ "$NODE_ENV" = "development" ]; then
  echo "Development mode detected"

  echo "Generating Prisma Client..."
  if ! bunx prisma generate; then
    echo "ERROR: Prisma Client generation failed"
    exit 1
  fi
  echo "Prisma Client generated"

  echo "Running database migrations (dev mode)..."
  if ! bunx prisma migrate deploy; then
    echo "ERROR: Database migration failed"
    exit 1
  fi
  echo "Migrations completed"

  echo "Running database seed..."
  if bun run prisma:seed; then
    echo "Seed completed"
  else
    echo "WARNING: Seed failed or was skipped (this is usually OK)"
  fi
  
# 生產環境專用：
else
  echo "Production mode detected"

  echo "Running database migrations..."
  if ! bunx prisma migrate deploy; then
    echo "ERROR: Database migration failed"
    exit 1
  fi
  echo "Migrations completed"

  echo "Running database seed..."
  if bun run prisma:seed:prod; then
    echo "Seed completed"
  else
    echo "WARNING: Seed failed or was skipped (database may already be initialized)"
  fi
fi

echo "=== Setup completed ==="
echo "Starting application..."
exec "$@"