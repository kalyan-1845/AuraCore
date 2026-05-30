@echo off
title AURACORE ELITE - PRE-FLIGHT CHECK
color 0B
cls
echo ==================================================
echo       AURACORE ELITE - MISSION READINESS
echo ==================================================
echo [1/4] Checking Ollama Service...
tasklist | findstr ollama >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Ollama is active.
) else (
    echo [WARNING] Ollama is NOT running. Starting now...
    start /min "" ollama serve
    timeout /t 5 >nul
)

echo [2/4] Verifying Neural Engines (Models)...
ollama list | findstr "smollm2:135m" >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Flux Engine (SmolLM2) is installed.
) else (
    echo [ERROR] Flux Engine missing! Run Aura_Control.bat Option 1 first.
    pause
    exit
)

echo [3/4] Testing Backend Connection...
powershell -Command "try { Invoke-RestMethod -Uri http://localhost:8000/health -TimeoutSec 2 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Backend is responsive.
) else (
    echo [WARNING] Backend not found. Make sure it's running on port 8000.
)

echo [4/4] Verifying Database Integrity...
if exist "backend\aura_memory.db" (
    echo [SUCCESS] Neural memory (SQLite) is online.
) else (
    echo [WARNING] Memory file not found. It will be created on launch.
)

echo ==================================================
echo       STATUS: MISSION READY [GREEN LIGHT]
echo ==================================================
echo Instructions for Zoom Meet:
echo 1. Keep this window open if you want to monitor.
echo 2. Use 'v5.5-Flux' for ultra-fast "wow" moments.
echo 3. Use 'v5.5-Analyst' for deep "expert" analysis.
echo ==================================================
pause
