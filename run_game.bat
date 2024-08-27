@echo off

REM Kill any existing http-server processes
taskkill /F /IM node.exe /FI "WINDOWTITLE eq http-server*" >nul 2>&1

REM Kill any existing node processes using port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

REM Close previously opened command windows if PIDs exist
if exist http-server-pid.txt (
    for /f %%i in (http-server-pid.txt) do taskkill /F /PID %%i >nul 2>&1
    del http-server-pid.txt
)
if exist node-server-pid.txt (
    for /f %%i in (node-server-pid.txt) do taskkill /F /PID %%i >nul 2>&1
    del node-server-pid.txt
)

REM Start http-server and save its PID
start /B cmd /c "cd C:\Users\admin\Desktop\code\inky\game && http-server & echo !PID! > http-server-pid.txt"

REM Start node server.js and save its PID
start /B cmd /c "cd C:\Users\admin\Desktop\code\inky && node server.js & echo !PID! > node-server-pid.txt"

REM Open a new command prompt to keep the script running
start cmd /k "echo Servers are running. Close this window to stop the servers."