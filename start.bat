@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on PATH. Install Python 3.11+ and retry.
    exit /b 1
)

echo Installing backend dependencies (fast if already installed)...
python -m pip install -q -r backend\requirements.txt

if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

start "PC Monitor - Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "PC Monitor - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend  http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs)
echo Frontend http://127.0.0.1:5173  (open this in a browser)
echo.
echo Both servers run in separate windows; close those windows to stop them.
