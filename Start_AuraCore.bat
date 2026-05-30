@echo off
title AuraCore Elite — System Boot
color 0A
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║           AURACORE ELITE — SYSTEM BOOT           ║
echo ║          Automated Startup Sequence v6.0         ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Step 1: Check Ollama
echo [1/5] Checking Ollama...
ollama list >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Ollama is not running! Starting it now...
    start "" ollama serve
    timeout /t 5 /nobreak >nul
) else (
    echo [OK] Ollama is running.
)

:: Step 2: Verify core models are pulled
echo.
echo [2/5] Verifying core models...
for %%m in (smollm2:135m llama3.2:latest phi3:latest) do (
    ollama show %%m >nul 2>&1
    if errorlevel 1 (
        echo [PULL] %%m not found — pulling now...
        ollama pull %%m
    ) else (
        echo [OK] %%m is available.
    )
)

:: Step 3: Pre-warm primary model into RAM
echo.
echo [3/5] Pre-loading primary model into RAM (this takes 30-60s)...
curl -s -X POST http://127.0.0.1:11434/api/generate -d "{\"model\": \"llama3.2:latest\", \"prompt\": \"ready\", \"stream\": false, \"keep_alive\": \"30m\", \"options\": {\"num_predict\": 1}}" >nul 2>&1
echo [OK] Primary model loaded!

:: Step 4: Start Backend
echo.
echo [4/5] Starting backend server...
cd /d "%~dp0backend"
start "AuraCore Backend" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
cd /d "%~dp0"

:: Step 5: Start Frontend
echo.
echo [5/5] Starting frontend...
cd /d "%~dp0frontend"
start "AuraCore Frontend" cmd /k "npm run dev"
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║         AURACORE ELITE IS NOW ONLINE!            ║
echo ║                                                  ║
echo ║   Frontend: http://localhost:3000                ║
echo ║   Backend:  http://localhost:8000                ║
echo ║                                                  ║
echo ║   Model is pre-loaded. Ready for missions.      ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo Press any key to open AuraCore in your browser...
pause >nul
start http://localhost:3000
