@echo off
title AURACORE SUPERCHARGER v5.5
color 0b

echo.
echo  █████╗ ██╗   ██╗██████╗  █████╗  ██████╗ ██████╗ ██████╗ ███████╗
echo ██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
echo ███████║██║   ██║██████╔╝███████║██║     ██║   ██║██████╔╝█████╗  
echo ██╔══██║██║   ██║██╔══██╗██╔══██║██║     ██║   ██║██╔══██╗██╔══╝  
echo ██║  ██║╚██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝██║  ██║███████╗
echo ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
echo.
echo [SUPERCHARGER] ENGAGING NEURAL BOOST SEQUENCE...
echo.

:: 1. Performance Optimization Environment
echo [1/4] OPTIMIZING NEURAL PARALLELISM...
setx OLLAMA_NUM_PARALLEL 4
setx OLLAMA_MAX_LOADED_MODELS 4
echo [OK] Neural concurrency set to ELITE levels.

:: 2. Model Synchronization
echo [2/4] SYNCHRONIZING NEURAL ENGINES (THIS MAY TAKE A FEW MINS)...

echo - Syncing Flux Engine (smollm2:135m)...
ollama pull smollm2:135m

echo - Syncing Expert Engine (phi3:latest)...
ollama pull phi3:latest

echo - Syncing High-Density Engine (llama3.2:latest)...
ollama pull llama3.2:latest

echo - Syncing Specialized Coder (bkr-coder:latest)...
ollama pull bkr-coder:latest

:: 3. VRAM Purge & Restart
echo [3/4] RESTARTING NEURAL SERVICE TO PURGE VRAM...
taskkill /f /im "ollama app.exe" >nul 2>&1
taskkill /f /im "ollama.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "ollama app.exe"
echo [OK] Neural service refreshed.

:: 4. Pre-loading for Demo
echo [4/4] WARMING UP ENGINES FOR ROCKET SPEED...
start /min "" ollama run smollm2:135m ""
start /min "" ollama run phi3 ""
echo [OK] Core engines are now warm in VRAM.

echo.
echo ======================================================
echo [SYSTEM STATUS] ALL ENGINES OPTIMIZED AND BOOSTED.
echo [READY] YOU ARE NOW CLEAR FOR MISSION KICKOFF.
echo ======================================================
echo.
pause
