#!/bin/bash
PROJECT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Imgen Studio..."

# Start backend if not running
if ! lsof -i :8000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting backend..."
  cd "$PROJECT/backend"
  .venv/bin/uvicorn app.main:app --port 8000 > /tmp/imgen-backend.log 2>&1 &
  sleep 2
else
  echo "✓ Backend already running"
fi

# Start frontend if not running
if ! lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting frontend..."
  cd "$PROJECT/frontend"
  /usr/local/bin/npm run dev > /tmp/imgen-frontend.log 2>&1 &
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

echo "✅ Imgen Studio is running — opening browser..."
open http://localhost:3000
