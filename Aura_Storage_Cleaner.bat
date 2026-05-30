@echo off
title AURACORE STORAGE CLEANER
color 0a

echo [STORAGE] OPTIMIZING PROJECT DIRECTORY...
rmdir /s /q "backend\__pycache__" 2>nul
rmdir /s /q "frontend\.next" 2>nul
del /s /q "*.log" 2>nul
echo [OK] Project cache cleared.

echo [STORAGE] OPTIMIZING DATABASE...
:: Vacuum the SQLite database to reduce its size on disk
sqlite3 backend\aura_memory.db "VACUUM;" 2>nul
echo [OK] Database compacted.

echo [STORAGE] SYSTEM TEMP CLEANUP...
del /q /f /s %TEMP%\* 2>nul
echo [OK] Temporary system files cleared.

echo.
echo ======================================================
echo [SYSTEM STATUS] OPTIMIZATION COMPLETE.
echo [INFO] Run 'ollama rm <model_name>' to free up more GBs.
echo ======================================================
echo.
pause
