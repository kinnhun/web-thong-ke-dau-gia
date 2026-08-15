@echo off
title Web Thong Ke Dau Gia

echo ========================================
echo   Dang kiem tra thu muc du an...
echo ========================================

:: Tự động tìm đường dẫn thư mục dự án
if exist "d:\web thong ke dau gia\web-thong-ke-dau-gia\package.json" (
    cd /d "d:\web thong ke dau gia\web-thong-ke-dau-gia"
) else if exist "d:\web-thong-ke-dau-gia\package.json" (
    cd /d "d:\web-thong-ke-dau-gia"
) else if exist "%~dp0web-thong-ke-dau-gia\package.json" (
    cd /d "%~dp0web-thong-ke-dau-gia"
) else if exist "%~dp0package.json" (
    cd /d "%~dp0"
) else (
    echo.
    echo ❌ KHONG TIM THAY THU MUC DU AN!
    echo Vui long kiem tra lai duong dan: D:\web thong ke dau gia\web-thong-ke-dau-gia
    echo.
    pause
    exit /b
)

echo.
echo ✅ Da vao thu muc: %CD%
echo ========================================
echo   Dang khoi dong du an (http://localhost:1234)...
echo ========================================
echo.

:: Mở trình duyệt sau 4 giây
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:1234"

:: Chạy dự án chế độ Dev (tự động bật Frontend, Backend API và Bot Crawl)
npm run dev

echo.
echo ⚠️ Dự án đã dừng lại.
pause
