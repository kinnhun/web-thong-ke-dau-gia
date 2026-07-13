@echo off
chcp 65001 >nul 2>&1
title Kiem Tra Moi Truong Du An

cd /d "%~dp0"

echo.
echo ================================================
echo   KIEM TRA MOI TRUONG - Web Thong Ke Dau Gia
echo ================================================
echo.

set HAS_ERROR=0
set NEED_NPM_INSTALL=0

:: ========================================
:: 1. Kiem tra Node.js
:: ========================================
echo [1/6] Kiem tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] Node.js CHUA CAI DAT
    echo   [!] Mo trang tai Node.js...
    start https://nodejs.org/en/download/
    echo   [!] Hay cai dat Node.js LTS roi chay lai file nay.
    set HAS_ERROR=1
    goto :CHECK_END
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   [OK] Node.js %NODE_VER%

:: ========================================
:: 2. Kiem tra npm
:: ========================================
echo [2/6] Kiem tra npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] npm CHUA CAI DAT
    echo   [!] npm thuong di kem Node.js. Cai lai Node.js.
    set HAS_ERROR=1
    goto :CHECK_END
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo   [OK] npm v%NPM_VER%

:: ========================================
:: 3. Kiem tra MongoDB
:: ========================================
echo [3/6] Kiem tra MongoDB...
set MONGO_OK=0

:: Kiem tra service truoc
sc query MongoDB >nul 2>&1
if %errorlevel% equ 0 set MONGO_OK=1

:: Kiem tra mongod trong PATH
where mongod >nul 2>&1
if %errorlevel% equ 0 set MONGO_OK=1

:: Kiem tra mongosh trong PATH
where mongosh >nul 2>&1
if %errorlevel% equ 0 set MONGO_OK=1

if %MONGO_OK%==1 (
    echo   [OK] MongoDB da cai dat
) else (
    echo   [X] MongoDB CHUA CAI DAT
    echo   [!] Mo trang tai MongoDB Community Server...
    start https://www.mongodb.com/try/download/community
    echo   [!] Chon "Complete" install, tick "Install MongoDB as a Service".
    set HAS_ERROR=1
)

:: Kiem tra MongoDB co dang chay khong
echo        Kiem tra MongoDB dang chay...
sc query MongoDB >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] MongoDB service dang chay
    goto :MONGO_DONE
)

net start MongoDB >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] MongoDB da duoc khoi dong
    goto :MONGO_DONE
)

if %MONGO_OK%==0 goto :MONGO_DONE

echo   [!] MongoDB service khong tim thay. Thu ket noi truc tiep...
mongosh --quiet --eval "db.runCommand({ping:1})" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] MongoDB dang chay
    goto :MONGO_DONE
)

echo   [!] Khong the ket noi MongoDB.
echo   [!] Hay khoi dong MongoDB thu cong.
set HAS_ERROR=1

:MONGO_DONE

:: ========================================
:: 4. Kiem tra Git
:: ========================================
echo [4/6] Kiem tra Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo   [~] Git chua cai - khong bat buoc nhung nen co
    echo   [!] Tai tai: https://git-scm.com/downloads
    goto :GIT_DONE
)
for /f "tokens=*" %%i in ('git --version') do set GIT_VER=%%i
echo   [OK] %GIT_VER%
:GIT_DONE

:: ========================================
:: 5. Kiem tra node_modules
:: ========================================
echo [5/6] Kiem tra node_modules...
if not exist "node_modules" (
    echo   [X] Chua co node_modules - root
    set NEED_NPM_INSTALL=1
) else (
    echo   [OK] node_modules - root
)

if not exist "bot-crawls-data\node_modules" (
    echo   [X] Chua co node_modules - bot-crawls-data
    set NEED_NPM_INSTALL=1
) else (
    echo   [OK] node_modules - bot-crawls-data
)

:: ========================================
:: 6. Kiem tra file .env
:: ========================================
echo [6/6] Kiem tra cau hinh .env...
if exist "bot-crawls-data\.env" (
    echo   [OK] bot-crawls-data\.env ton tai
    goto :ENV_DONE
)

echo   [!] Chua co file bot-crawls-data\.env
echo   [!] Tao file .env mac dinh...
> "bot-crawls-data\.env" (
    echo MONGO_URI=mongodb://127.0.0.1:27017/thong_ke_dau_gia
    echo API_PORT=4321
    echo CRAWL_CONCURRENCY=5
    echo CRAWL_DELAY_MS=300
    echo CRAWL_PAGE_SIZE=100
    echo CRON_SCHEDULE=*/15 * * * *
)
echo   [OK] Da tao bot-crawls-data\.env voi cau hinh mac dinh

:ENV_DONE

:: ========================================
:: Cai dat npm packages neu can
:: ========================================
if %NEED_NPM_INSTALL%==0 goto :SKIP_INSTALL
if %HAS_ERROR%==1 goto :SKIP_INSTALL

echo.
echo ================================================
echo   Dang cai dat npm packages...
echo ================================================
echo.
call npm install
if %errorlevel% neq 0 (
    echo   [X] npm install THAT BAI!
    set HAS_ERROR=1
) else (
    echo   [OK] npm install thanh cong
)

:SKIP_INSTALL

:: ========================================
:: Ket qua
:: ========================================
:CHECK_END
echo.
echo ================================================
if %HAS_ERROR%==1 (
    echo   [X] CO LOI - Hay xu ly cac van de phia tren
    echo       roi chay lai file nay.
) else (
    echo   [OK] TAT CA SAN SANG!
    echo   Chay "chay du an.bat" de bat dau.
)
echo ================================================
echo.
pause
