#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting MigrateDB Application..."

# Check Node.js version
echo "🔍 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version is $(node -v). Please upgrade to Node.js v18 or higher to run this application."
    echo "   See: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version $(node -v) is compatible."

# 1. Setup and Start Backend
echo "📦 Setting up Backend..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "Installing backend dependencies..."
pip install -r requirements.txt

# Start Backend Server
echo "Starting Backend Server on port 8000..."
# Check and kill any process on port 8000
if lsof -ti:8000; then
  echo "Killing process on port 8000..."
  kill -9 $(lsof -ti:8000)
fi
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait for backend to start (simple sleep or check)
sleep 2

# 2. Setup and Start Frontend
echo "🎨 Setting up Frontend..."
cd ../frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start Frontend Dev Server
echo "Starting Frontend Server..."
npm run dev

# Wait for any process to exit
wait
