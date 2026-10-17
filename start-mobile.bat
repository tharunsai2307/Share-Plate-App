@echo off
title SharePlate Mobile App
echo ========================================================
echo    SharePlate Cross-Platform Mobile App Launcher
echo ========================================================
echo.
echo [*] Checking local environment...
cd /d "%~dp0"

echo [*] Starting Expo Metro bundler on port 8081...
start "SharePlate Mobile Metro Server" cmd /k "npm run web -w apps/mobile"

echo [*] Waiting for Metro bundler initialization...
timeout /t 5 /nobreak >nul

echo [*] Launching Mobile App in browser mobile emulator mode...
start http://localhost:8081

echo.
echo [OK] Mobile App is running at http://localhost:8081
echo [TIP] You can also run SharePlate-Mobile.exe directly!
echo ========================================================
