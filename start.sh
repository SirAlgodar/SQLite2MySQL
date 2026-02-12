#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting MigrateDB Application..."

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
