@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo Installing server dependencies...
    call npm install
)
if not exist inky\node_modules (
    echo Installing client dependencies...
    pushd inky
    call npm install
    popd
)

echo Starting server (nodemon)...
start "inky-server" cmd /c "npm run server:dev"

echo Starting client (vite)...
cd inky
npm run dev
