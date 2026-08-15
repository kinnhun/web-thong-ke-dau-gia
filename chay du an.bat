@echo off
title Web Thong Ke Dau Gia

:: Tự động tìm đường dẫn dự án chính xác (bao gồm cả thư mục con web-thong-ke-dau-gia)
if exist "d:\web thong ke dau gia\web-thong-ke-dau-gia\package.json" (
    cd /d "d:\web thong ke dau gia\web-thong-ke-dau-gia"
) else if exist "%~dp0web-thong-ke-dau-gia\package.json" (
    cd /d "%~dp0web-thong-ke-dau-gia"
) else if exist "d:\web-thong-ke-dau-gia\package.json" (
    cd /d "d:\web-thong-ke-dau-gia"
) else if exist "d:\web thong ke dau gia\package.json" (
    cd /d "d:\web thong ke dau gia"
) else (
    cd /d "%~dp0"
)

echo ========================================
echo   Dang khoi dong du an...
echo   Frontend: http://localhost:1234
echo ========================================
echo.

:: Mo trinh duyet sau 3 giay (cho server khoi dong)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:1234"

:: Chay du an
npm run start
