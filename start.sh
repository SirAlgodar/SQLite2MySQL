#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting MigrateDB Application..."

# Run setup first
./setup.sh
if [ $? -ne 0 ]; then
    echo "❌ Setup failed."
    exit 1
fi

# 1. Start Backend
echo "🚀 Starting Backend Server..."
cd backend
source venv/bin/activate

# Check and kill any process on port 8000
if lsof -ti:8000; then
  echo "Killing process on port 8000..."
  kill -9 $(lsof -ti:8000)
fi
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait for backend to start (simple sleep or check)
sleep 2

# 2. Start Frontend
echo "🚀 Starting Frontend Server..."
cd ../frontend

# Start Frontend Dev Server
npm run dev

# Wait for any process to exit
wait
