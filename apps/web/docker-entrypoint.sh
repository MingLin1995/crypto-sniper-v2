#!/bin/sh
set -e

echo "=== Starting web setup ==="

# 開發環境專用：安裝/更新依賴
if [ "$NODE_ENV" = "development" ]; then
  cd /app
  echo "Installing/updating workspace dependencies..."
  if ! bun install; then
    echo "ERROR: Dependency installation failed"
    exit 1
  fi
  echo "Dependencies up-to-date"
  cd /app/apps/web
fi

echo "=== Setup completed ==="
exec "$@"
