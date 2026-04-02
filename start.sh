#!/bin/bash
PROJECT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Imagen Studio..."

# Load nvm to get the correct node/npm version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Fallback: add all nvm node versions to PATH
if ! command -v npm &>/dev/null; then
  for d in "$HOME/.nvm/versions/node"/*/bin; do
    [ -d "$d" ] && export PATH="$d:$PATH" && break
  done
fi

if ! command -v npm &>/dev/null; then
  echo "✗ npm not found — please install Node.js via nvm"
  exit 1
fi

echo "  node $(node -v), npm $(npm -v)"

# Start backend if not running
if ! lsof -i :8000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting backend..."
  cd "$PROJECT/backend"
  .venv/bin/uvicorn app.main:app --port 8000 > /tmp/imagen-backend.log 2>&1 &
  sleep 2
  if lsof -i :8000 -sTCP:LISTEN -t &>/dev/null; then
    echo "✓ Backend running on :8000"
  else
    echo "✗ Backend failed — check /tmp/imagen-backend.log"
    tail -5 /tmp/imagen-backend.log
    exit 1
  fi
else
  echo "✓ Backend already running"
fi

# Start frontend if not running
if ! lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
  echo "▶ Starting frontend..."
  cd "$PROJECT/frontend"
  npm run dev > /tmp/imagen-frontend.log 2>&1 &
  echo "⏳ Waiting for frontend (up to 20s)..."
  for i in $(seq 1 20); do
    sleep 1
    if lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
      echo "✓ Frontend ready on :3000"
      break
    fi
    if [ $i -eq 20 ]; then
      echo "✗ Frontend timeout — check /tmp/imagen-frontend.log"
      tail -5 /tmp/imagen-frontend.log
      exit 1
    fi
  done
else
  echo "✓ Frontend already running"
fi

echo "✅ Imagen Studio is running — opening browser..."
sleep 1
open http://localhost:3000
