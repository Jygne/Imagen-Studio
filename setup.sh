#!/bin/bash
PROJECT="$(cd "$(dirname "$0")" && pwd)"
echo "🔧 Setting up BuyBox..."

# Backend
echo "▶ Installing Python dependencies..."
cd "$PROJECT/backend"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q
echo "✓ Backend ready"

# Frontend
echo "▶ Installing frontend dependencies..."
cd "$PROJECT/frontend"
/usr/local/bin/npm install -q
echo "✓ Frontend ready"

echo ""
echo "✅ Setup complete! Double-click BuyBox.app to launch."
