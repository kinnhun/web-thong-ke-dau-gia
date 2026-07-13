#!/bin/bash

cd "$(dirname "$0")"

echo ""
echo "================================================"
echo "  KIEM TRA MOI TRUONG - Web Thong Ke Dau Gia"
echo "================================================"
echo ""

HAS_ERROR=0
NEED_NPM_INSTALL=0

# ========================================
# 1. Kiem tra Node.js
# ========================================
echo "[1/6] Kiem tra Node.js..."
if ! command -v node &> /dev/null; then
    echo "  [X] Node.js CHUA CAI DAT"
    if command -v brew &> /dev/null; then
        echo "  [!] Dang cai dat Node.js qua Homebrew..."
        brew install node
    else
        echo "  [!] Cai Homebrew truoc: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo "  [!] Sau do chay: brew install node"
        HAS_ERROR=1
    fi
else
    echo "  [OK] Node.js $(node -v)"
fi

# ========================================
# 2. Kiem tra npm
# ========================================
echo "[2/6] Kiem tra npm..."
if ! command -v npm &> /dev/null; then
    echo "  [X] npm CHUA CAI DAT"
    echo "  [!] npm thuong di kem Node.js. Cai lai Node.js."
    HAS_ERROR=1
else
    echo "  [OK] npm v$(npm -v)"
fi

# ========================================
# 3. Kiem tra MongoDB
# ========================================
echo "[3/6] Kiem tra MongoDB..."
MONGO_OK=0

if command -v mongod &> /dev/null; then
    MONGO_OK=1
elif command -v mongosh &> /dev/null; then
    MONGO_OK=1
elif brew list mongodb-community &> /dev/null 2>&1; then
    MONGO_OK=1
fi

if [ "$MONGO_OK" -eq 1 ]; then
    echo "  [OK] MongoDB da cai dat"
else
    echo "  [X] MongoDB CHUA CAI DAT"
    if command -v brew &> /dev/null; then
        echo "  [!] Dang cai dat MongoDB qua Homebrew..."
        brew tap mongodb/brew
        brew install mongodb-community
        MONGO_OK=1
    else
        echo "  [!] Cai Homebrew truoc, sau do chay:"
        echo "      brew tap mongodb/brew"
        echo "      brew install mongodb-community"
        HAS_ERROR=1
    fi
fi

# Kiem tra MongoDB co dang chay khong
echo "       Kiem tra MongoDB dang chay..."
if pgrep -x mongod > /dev/null 2>&1; then
    echo "  [OK] MongoDB dang chay"
else
    echo "  [!] MongoDB chua chay. Thu khoi dong..."
    if command -v brew &> /dev/null; then
        brew services start mongodb-community
        sleep 2
        if pgrep -x mongod > /dev/null 2>&1; then
            echo "  [OK] MongoDB da duoc khoi dong"
        else
            echo "  [!] Khong the khoi dong MongoDB."
            echo "  [!] Thu chay thu cong: mongod --dbpath /usr/local/var/mongodb"
            HAS_ERROR=1
        fi
    else
        echo "  [!] Khong the khoi dong MongoDB."
        HAS_ERROR=1
    fi
fi

# ========================================
# 4. Kiem tra Git
# ========================================
echo "[4/6] Kiem tra Git..."
if ! command -v git &> /dev/null; then
    echo "  [~] Git chua cai - khong bat buoc nhung nen co"
    echo "  [!] Chay: xcode-select --install"
else
    echo "  [OK] $(git --version)"
fi

# ========================================
# 5. Kiem tra node_modules
# ========================================
echo "[5/6] Kiem tra node_modules..."
if [ ! -d "node_modules" ]; then
    echo "  [X] Chua co node_modules - root"
    NEED_NPM_INSTALL=1
else
    echo "  [OK] node_modules - root"
fi

if [ ! -d "bot-crawls-data/node_modules" ]; then
    echo "  [X] Chua co node_modules - bot-crawls-data"
    NEED_NPM_INSTALL=1
else
    echo "  [OK] node_modules - bot-crawls-data"
fi

# ========================================
# 6. Kiem tra file .env
# ========================================
echo "[6/6] Kiem tra cau hinh .env..."
if [ -f "bot-crawls-data/.env" ]; then
    echo "  [OK] bot-crawls-data/.env ton tai"
else
    echo "  [!] Chua co file bot-crawls-data/.env"
    echo "  [!] Tao file .env mac dinh..."
    cat > "bot-crawls-data/.env" << 'EOF'
MONGO_URI=mongodb://127.0.0.1:27017/thong_ke_dau_gia
API_PORT=4321
CRAWL_CONCURRENCY=5
CRAWL_DELAY_MS=300
CRAWL_PAGE_SIZE=100
CRON_SCHEDULE=*/15 * * * *
EOF
    echo "  [OK] Da tao bot-crawls-data/.env voi cau hinh mac dinh"
fi

# ========================================
# Cai dat npm packages neu can
# ========================================
if [ "$NEED_NPM_INSTALL" -eq 1 ] && [ "$HAS_ERROR" -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "  Dang cai dat npm packages..."
    echo "================================================"
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "  [X] npm install THAT BAI!"
        HAS_ERROR=1
    else
        echo "  [OK] npm install thanh cong"
    fi
fi

# ========================================
# Ket qua
# ========================================
echo ""
echo "================================================"
if [ "$HAS_ERROR" -eq 1 ]; then
    echo "  [X] CO LOI - Hay xu ly cac van de phia tren"
    echo "      roi chay lai file nay."
else
    echo "  [OK] TAT CA SAN SANG!"
    echo "  Chay ./start.sh de bat dau."
fi
echo "================================================"
echo ""
