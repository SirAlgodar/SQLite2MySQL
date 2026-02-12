#!/bin/bash

# Stop on error
set -e

echo "🛠️  Verifying System Dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed."
    exit 1
fi

echo "✅ System dependencies are met."

# 1. Setup Backend
echo "📦 Setting up Backend..."
cd backend

# Create venv if it doesn't exist or is broken
if [ ! -f "venv/bin/activate" ]; then
    echo "   Creating virtual environment..."
    rm -rf venv # Remove broken/partial venv
    if ! python3 -m venv venv; then
        echo "❌ Error: Failed to create virtual environment."
        echo "   On Linux, try: sudo apt install python3-venv"
        exit 1
    fi
fi

# Install requirements
echo "   Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 2. Setup Frontend
echo "🎨 Setting up Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "   Installing Node modules..."
    npm install
fi
cd ..

echo "✅ Setup complete successfully!"
