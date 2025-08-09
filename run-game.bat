@echo off
echo "Starting server..."
start "server" cmd /c "node server/index.js"
echo "Starting frontend..."
cd inky
if not exist node_modules (
    echo "node_modules not found. Running npm install..."
    npm install
)
npm run dev