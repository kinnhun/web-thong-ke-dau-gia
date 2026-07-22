# 🛠️ Hướng Dẫn Cài Đặt Môi Trường

Hướng dẫn từng bước để cài đặt môi trường chạy dự án **Web Thống Kê Đấu Giá**.

---

## 📋 Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Bắt buộc |
|---|---|---|
| Node.js | v18+ (khuyến nghị v20 LTS) | ✅ |
| npm | v9+ (đi kèm Node.js) | ✅ |
| MongoDB | v6+ (Community Server) | ✅ |
| Git | v2+ | ⬜ Không bắt buộc |

---

## 🪟 Cài đặt trên Windows

### Bước 1: Cài đặt Node.js

1. Truy cập: **https://nodejs.org/en/download/**
2. Tải bản **LTS** (khuyến nghị) — chọn **Windows Installer (.msi)**
3. Chạy file `.msi` vừa tải:
   - Nhấn **Next** → **Next**
   - ✅ Tick **"Automatically install the necessary tools"** nếu có
   - Nhấn **Install** → **Finish**
4. Kiểm tra đã cài thành công:
   ```
   Mở Command Prompt (cmd) → gõ:
   node -v
   npm -v
   ```
   Nếu hiện số phiên bản → thành công ✅

---

### Bước 2: Cài đặt MongoDB

1. Truy cập: **https://www.mongodb.com/try/download/community**
2. Chọn:
   - **Version**: chọn bản mới nhất (8.x)
   - **Platform**: Windows
   - **Package**: MSI
3. Tải và chạy file `.msi`:
   - Chọn **Complete** (cài đầy đủ)
   - ✅ **QUAN TRỌNG**: Tick **"Install MongoDB as a Service"**
     - Service Name: `MongoDB`
     - Data Directory: để mặc định
   - ✅ Tick **"Install MongoDB Compass"** (công cụ quản lý DB, tùy chọn)
   - Nhấn **Install** → **Finish**
4. Kiểm tra MongoDB đang chạy:
   ```
   Mở Command Prompt (cmd) → gõ:
   sc query MongoDB
   ```
   Nếu thấy `STATE: RUNNING` → thành công ✅

> **💡 Mẹo**: Nếu MongoDB không chạy, mở **Services** (gõ `services.msc` trong Start) → tìm **MongoDB Server** → chuột phải → **Start**

---

### Bước 3: Cài đặt Git (không bắt buộc)

1. Truy cập: **https://git-scm.com/downloads/win**
2. Tải bản **64-bit Git for Windows Setup**
3. Chạy cài đặt → nhấn **Next** liên tục (giữ mặc định) → **Install**
4. Kiểm tra:
   ```
   git --version
   ```

---

### Bước 4: Cài đặt dự án

1. Mở **Command Prompt** hoặc **PowerShell**
2. Di chuyển đến thư mục dự án:
   ```
   cd D:\web-thong-ke-dau-gia
   ```
3. Cài đặt các packages:
   ```
   npm install
   ```
   Đợi cho đến khi hoàn tất (có thể mất 2-5 phút)

---

### Bước 5: Cấu hình file .env

1. Tạo file `bot-crawls-data\.env` với nội dung:
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/thong_ke_dau_gia
   API_PORT=4321
   CRAWL_CONCURRENCY=5
   CRAWL_DELAY_MS=300
   CRAWL_PAGE_SIZE=100
   CRON_SCHEDULE=*/15 * * * *
   ```

> **💡 Mẹo**: Hoặc chạy file `kiem tra moi truong.bat` để tự động tạo file `.env`

---

### Bước 6: Chạy dự án

**Cách 1**: Double-click vào file **`chay du an.bat`**

**Cách 2**: Mở terminal:
```
cd D:\web-thong-ke-dau-gia
npm run start
```

Truy cập: **http://localhost:1234**

---

## 🍎 Cài đặt trên macOS 10.12.6 (Sierra)

> ⚠️ **LƯU Ý QUAN TRỌNG**: macOS 10.12.6 là phiên bản cũ. Các phần mềm mới nhất **không hỗ trợ** phiên bản này. Hướng dẫn bên dưới sử dụng các phiên bản tương thích.

| Phần mềm | Phiên bản tương thích macOS 10.12.6 |
|---|---|
| Node.js | **v16.x** (bản cuối hỗ trợ 10.12) |
| MongoDB | **4.4.x** (bản cuối hỗ trợ 10.12) |
| Homebrew | Cần cài qua legacy method |

---

### Bước 1: Cài đặt Homebrew

Mở **Terminal** và chạy:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> ⚠️ Nếu Homebrew báo không hỗ trợ macOS 10.12, thử cách sau:
> ```bash
> git clone https://github.com/Homebrew/brew ~/.homebrew
> export PATH="$HOME/.homebrew/bin:$PATH"
> echo 'export PATH="$HOME/.homebrew/bin:$PATH"' >> ~/.bash_profile
> ```

Kiểm tra:
```bash
brew --version
```

---

### Bước 2: Cài đặt Node.js v16

**Cách 1 — Dùng nvm (khuyến nghị):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Đóng Terminal, mở lại, rồi chạy:
```bash
nvm install 16
nvm use 16
nvm alias default 16
```

**Cách 2 — Tải trực tiếp:**

1. Truy cập: **https://nodejs.org/dist/latest-v16.x/**
2. Tải file `node-v16.xx.x.pkg` (macOS Installer)
3. Chạy file `.pkg` để cài đặt

Kiểm tra:
```bash
node -v    # Phải hiện v16.x.x
npm -v
```

---

### Bước 3: Cài đặt MongoDB 4.4

```bash
brew tap mongodb/brew
brew install mongodb-community@4.4
```

> ⚠️ Nếu brew báo lỗi, tải trực tiếp:
> 1. Truy cập: **https://www.mongodb.com/try/download/community**
> 2. Chọn **Version: 4.4.x** — **Platform: macOS** — **Package: tgz**
> 3. Giải nén và cài thủ công:
>    ```bash
>    tar xzf mongodb-macos-x86_64-4.4.*.tgz
>    sudo cp mongodb-macos-x86_64-4.4.*/bin/* /usr/local/bin/
>    sudo mkdir -p /data/db
>    sudo chown -R $(whoami) /data/db
>    ```

Khởi động MongoDB:
```bash
# Nếu cài qua Homebrew:
brew services start mongodb-community@4.4

# Nếu cài thủ công:
mongod --dbpath /data/db &
```

Kiểm tra:
```bash
mongo --eval "db.runCommand({ping:1})"
```
Nếu thấy `{ "ok" : 1 }` → thành công ✅

---

### Bước 4: Cài đặt Git (không bắt buộc)

macOS 10.12 thường đã có Git sẵn. Kiểm tra:
```bash
git --version
```

Nếu chưa có:
```bash
xcode-select --install
```

---

### Bước 5: Cài đặt dự án

```bash
cd /đường-dẫn-tới/web-thong-ke-dau-gia
npm install
```

> ⚠️ Nếu gặp lỗi với một số package, thử:
> ```bash
> npm install --legacy-peer-deps
> ```

---

### Bước 6: Cấu hình file .env

```bash
cat > bot-crawls-data/.env << 'EOF'
MONGO_URI=mongodb://127.0.0.1:27017/thong_ke_dau_gia
API_PORT=4321
CRAWL_CONCURRENCY=5
CRAWL_DELAY_MS=300
CRAWL_PAGE_SIZE=100
CRON_SCHEDULE=*/15 * * * *
EOF
```

> **Hoặc** chạy `./kiem-tra-moi-truong.sh` để tự động tạo

---

### Bước 7: Chạy dự án

```bash
chmod +x start.sh
./start.sh
```

Hoặc:
```bash
npm run start
```

Truy cập: **http://localhost:1234**

---

## 🔗 Tổng hợp link tải

| Phần mềm | Link tải | Ghi chú |
|---|---|---|
| **Node.js LTS** (mới nhất) | https://nodejs.org/en/download/ | Windows, macOS mới |
| **Node.js v16** (macOS 10.12) | https://nodejs.org/dist/latest-v16.x/ | Dành cho macOS Sierra |
| **nvm** (quản lý Node) | https://github.com/nvm-sh/nvm | Khuyến nghị cho macOS |
| **MongoDB** (mới nhất) | https://www.mongodb.com/try/download/community | Windows, macOS mới |
| **MongoDB 4.4** (macOS 10.12) | https://www.mongodb.com/try/download/community | Chọn version 4.4.x |
| **MongoDB Compass** | https://www.mongodb.com/try/download/compass | Công cụ quản lý DB (tùy chọn) |
| **Git** | https://git-scm.com/downloads | Không bắt buộc |
| **Homebrew** (macOS) | https://brew.sh | Trình quản lý gói cho macOS |

---

## 🚀 Scripts tiện ích

| File | Hệ điều hành | Chức năng |
|---|---|---|
| `kiem tra moi truong.bat` | Windows | Tự kiểm tra & cài đặt môi trường |
| `kiem-tra-moi-truong.sh` | macOS/Linux | Tự kiểm tra & cài đặt môi trường |
| `chay du an.bat` | Windows | Chạy dự án + mở trình duyệt |
| `start.sh` | macOS/Linux | Chạy dự án + mở trình duyệt |

---

## ❓ Xử lý lỗi thường gặp

### MongoDB không chạy (Windows)
```
Mở Services (Win + R → services.msc)
→ Tìm "MongoDB Server"
→ Chuột phải → Start
```

### MongoDB không chạy (macOS)
```bash
brew services restart mongodb-community
```

### Lỗi "port 1234 is already in use"
```bash
# Windows
netstat -ano | findstr :1234
taskkill /PID <PID_number> /F

# macOS
lsof -i :1234
kill -9 <PID_number>
```

### Lỗi npm install
```bash
# Xóa cache và cài lại
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 🖥️ Cấu hình VPS khuyến nghị

### Phân tích tài nguyên dự án

Dự án chạy đồng thời nhiều thành phần nặng:

| Thành phần | RAM sử dụng | CPU | Ghi chú |
|---|---|---|---|
| **Next.js Frontend** | ~300-500 MB | Thấp | Server-side rendering |
| **Backend (Node.js)** | Lên tới **8 GB** | Trung bình | `--max-old-space-size=8192` |
| **MongoDB** | ~500 MB - 2 GB | Thấp-TB | Phụ thuộc data size |
| **Puppeteer (Chrome)** | ~500 MB - 1 GB/tab | Cao khi crawl | Headless Chrome |
| **Cloudflare Tunnel** | ~50 MB | Rất thấp | Chạy nền |
| **Hệ điều hành** | ~500 MB | — | Ubuntu minimal |

---

### Cấu hình đề xuất

#### 🟡 Tối thiểu (chạy được, có thể chậm)

| Thông số | Giá trị |
|---|---|
| **CPU** | 2 vCPU |
| **RAM** | 4 GB |
| **Ổ cứng** | 40 GB SSD |
| **OS** | Ubuntu 22.04 LTS |
| **Băng thông** | 1 TB/tháng |

> ⚠️ Với 4GB RAM, cần giảm `--max-old-space-size` xuống `2048` trong `bot-crawls-data/package.json` và hạn chế crawl đồng thời.

#### 🟢 Khuyến nghị (chạy ổn định)

| Thông số | Giá trị |
|---|---|
| **CPU** | 2-4 vCPU |
| **RAM** | **8 GB** |
| **Ổ cứng** | 80 GB SSD |
| **OS** | Ubuntu 22.04 LTS |
| **Băng thông** | 2 TB/tháng |

> ✅ Đủ chạy tất cả: frontend + backend + crawl + MongoDB cùng lúc.

#### 🔵 Tối ưu (chạy mượt, data lớn)

| Thông số | Giá trị |
|---|---|
| **CPU** | 4 vCPU |
| **RAM** | **16 GB** |
| **Ổ cứng** | 160 GB NVMe SSD |
| **OS** | Ubuntu 22.04 LTS |
| **Băng thông** | Unlimited |

> 🚀 Phù hợp khi data MongoDB lớn, crawl nhiều, nhiều người truy cập.

---

### Giá tham khảo VPS

| Nhà cung cấp | Gói 8GB RAM | Giá/tháng | Ghi chú |
|---|---|---|---|
| **Vultr** | 8 GB / 4 vCPU / 160 GB | ~$48/tháng | Có datacenter Singapore |
| **DigitalOcean** | 8 GB / 4 vCPU / 160 GB | ~$48/tháng | Có datacenter Singapore |
| **Linode (Akamai)** | 8 GB / 4 vCPU / 160 GB | ~$48/tháng | Ổn định |
| **Hetzner** | 8 GB / 4 vCPU / 160 GB | ~€13/tháng | Rẻ nhất, DC châu Âu |
| **Contabo** | 8 GB / 4 vCPU / 200 GB | ~$8/tháng | Rẻ, hiệu năng trung bình |
| **VPS Việt Nam** | 8 GB / 4 vCPU | ~200-400k/tháng | TINOHOST, AZDIGI, Viettel IDC |

> 💡 **Mẹo**: Chọn datacenter gần Việt Nam (Singapore/Tokyo) để có latency thấp.

---

### Cài đặt trên VPS Ubuntu

#### Bước 1: Cập nhật hệ thống
```bash
sudo apt update && sudo apt upgrade -y
```

#### Bước 2: Cài đặt Node.js v20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

#### Bước 3: Cài đặt MongoDB
```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Thêm repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Cài đặt
sudo apt update
sudo apt install -y mongodb-org

# Khởi động MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Kiểm tra
sudo systemctl status mongod
```

#### Bước 4: Cài đặt các dependencies cho Puppeteer
```bash
sudo apt install -y \
  ca-certificates fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 \
  libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
  libxdamage1 libxrandr2 xdg-utils wget libxss1 libgconf-2-4 \
  libxshmfence1 libglu1-mesa
```

#### Bước 5: Cài đặt Git và clone dự án
```bash
sudo apt install -y git
git clone <URL_REPO> /home/ubuntu/web-thong-ke-dau-gia
cd /home/ubuntu/web-thong-ke-dau-gia
```

#### Bước 6: Cài đặt packages và cấu hình
```bash
npm install

# Tạo file .env
cat > bot-crawls-data/.env << 'EOF'
MONGO_URI=mongodb://127.0.0.1:27017/thong_ke_dau_gia
API_PORT=4321
CRAWL_CONCURRENCY=5
CRAWL_DELAY_MS=300
CRAWL_PAGE_SIZE=100
CRON_SCHEDULE=*/15 * * * *
EOF
```

#### Bước 7: Build và chạy
```bash
# Build frontend
npm run build

# Chạy production
npm run start
```

---

### Chạy nền với PM2 (khuyến nghị cho VPS)

PM2 giúp ứng dụng tự khởi động lại khi crash hoặc khi VPS reboot.

```bash
# Cài PM2
sudo npm install -g pm2

# Chạy frontend
pm2 start "npm run start:frontend" --name "frontend"

# Chạy backend
pm2 start "npm run start:backend" --name "backend"

# Chạy tunnel
pm2 start "npm run start:tunnel" --name "tunnel"

# Tự khởi động khi VPS reboot
pm2 startup
pm2 save

# Xem trạng thái
pm2 status

# Xem logs
pm2 logs

# Restart tất cả
pm2 restart all
```

---

### Tối ưu VPS (nếu RAM ít)

Nếu VPS chỉ có **4GB RAM**, cần điều chỉnh:

1. **Giảm Node.js heap**: Sửa `bot-crawls-data/package.json`:
   ```
   --max-old-space-size=8192  →  --max-old-space-size=2048
   ```

2. **Thêm swap** (bộ nhớ ảo):
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Giảm crawl concurrency**: Trong `.env`:
   ```
   CRAWL_CONCURRENCY=2
   ```

4. **Giới hạn MongoDB RAM**: Tạo file `/etc/mongod.conf`:
   ```yaml
   storage:
     wiredTiger:
       engineConfig:
         cacheSizeGB: 0.5
   ```
   Sau đó: `sudo systemctl restart mongod`
