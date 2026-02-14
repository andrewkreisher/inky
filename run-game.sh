#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
fi

if [ ! -d "inky/node_modules" ]; then
    echo "Installing client dependencies..."
    (cd inky && npm install)
fi

# Start server with live reload (watches server/ directory)
echo "Starting server (nodemon)..."
npx nodemon --watch server server/index.js &
SERVER_PID=$!

# Start client dev server (Vite HMR handles live reload)
echo "Starting client (vite)..."
(cd inky && npm run dev) &
CLIENT_PID=$!

# Kill both on Ctrl+C
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
echo ""
echo "Both servers running. Press Ctrl+C to stop."
wait
