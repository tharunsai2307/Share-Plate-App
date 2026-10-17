@echo off
title SharePlate Admin Console
echo ========================================================
echo    SharePlate Operations Admin Console Launcher
echo ========================================================
echo.
echo [*] Checking local environment...
cd /d "%~dp0"

:: Check if server is already responding on port 3000
powershell -Command "$resp = try { (Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { 0 }; if ($resp -eq 200) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [*] Admin Console server is already running and healthy!
    goto open_browser
)

echo [*] Starting Next.js Admin Console server on port 3000...
start "SharePlate Admin Server" cmd /k "npm run dev -w apps/admin"

echo [*] Waiting for server initialization (up to 6 seconds)...
timeout /t 6 /nobreak >nul

:open_browser
echo [*] Launching Admin Console in your default browser...
start http://localhost:3000

echo.
echo [OK] Admin Console is active at http://localhost:3000
echo ========================================================
