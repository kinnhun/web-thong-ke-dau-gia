@echo off
title Web Thong Ke Dau Gia

cd /d "%~dp0"

echo ========================================
echo   Dang khoi dong du an...
echo   Frontend: http://localhost:1234
echo ========================================
echo.

:: Mo trinh duyet sau 3 giay (cho server khoi dong)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:1234"

:: Chay du an
npm run start
