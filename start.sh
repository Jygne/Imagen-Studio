#!/bin/bash
PROJECT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Imagen Studio..."

# Start backend if not running
if ! lsof -i :8000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting backend..."
  cd "$PROJECT/backend"
  .venv/bin/uvicorn app.main:app --port 8000 > /tmp/imagen-backend.log 2>&1 &
  sleep 2
else
  echo "✓ Backend already running"
fi

# Start frontend if not running
if ! lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting frontend..."
  cd "$PROJECT/frontend"
  PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" npm run dev > /tmp/imagen-frontend.log 2>&1 &
  echo "⏳ Waiting for frontend..."
  for i in $(seq 1 20); do
    sleep 1
    if lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
      echo "✓ Frontend ready"
      break
    fi
  done
else
  echo "✓ Frontend already running"
fi

echo "✅ Imagen Studio is running — opening browser..."
open http://localhost:3000
