# web-thong-ke-dau-gia

## Architecture / Rules

### File sẽ chỉnh sửa
- `README.md` (mục `Architecture / Rules`)

### Luồng xử lý chuẩn

#### Frontend (bắt buộc)
- `Page → Feature (container) → Hook → Service → API`
- `pages/*`: chỉ routing + mount 1 feature container
- `features/*`: container điều phối UI, không gọi axios
- `hooks/*` và `domains/*/*.hooks.ts`: xử lý logic, không render JSX
- `services/*`: nơi duy nhất thực hiện HTTP request
- `domains/*`: định nghĩa model/type + query keys + hooks domain

#### Backend (bắt buộc)
- `Request → Middleware → Controller → Service → Repo → Service → Controller → Response`
- `Socket → Service → Repo`

---

## FRONTEND – NEXT.JS (Pages Router)

### A1) Cấu trúc thư mục
Giữ nguyên cấu trúc sau, không đổi:

```text
src/
├── pages/
│   ├── _app.tsx
│   ├── _document.tsx
│   ├── index.tsx
│   ├── auth/
│   ├── listing/
│   ├── workspace/
│   ├── admin/
│   ├── profile/
│   └── widget.tsx
├── features/
├── domains/
├── components/
├── providers/
├── contexts/
├── lib/
├── services/
├── types/
├── utils/
├── config/
└── styles/
```

### A2) Trách nhiệm từng tầng
1. `pages/`
   - Chỉ routing.
   - Không gọi API.
   - Chỉ import từ `features/*` và `components/layout`.

2. `features/`
   - Chứa container cho từng màn hình/flow.
   - Được dùng hooks/domain/shared UI.
   - Không gọi axios trực tiếp.

3. `components/`
   - Shared UI thuần.
   - Không import `services/` hoặc `domains/`.

4. `hooks/`, `features/*/hooks/`, `domains/*/*.hooks.ts`
   - Logic-only, không render JSX.
   - Được gọi `services/*`, `domains/*`, mapper/query key.

5. `services/`
   - Nơi duy nhất được gọi HTTP/axios.
   - Không chứa UI logic.

6. `domains/`
   - Chứa `*.types.ts`, `*.keys.ts`, `*.mappers.ts`, `*.hooks.ts`, `*.api.ts`.
   - `*.api.ts` không được gọi axios trực tiếp; chỉ gọi `services/*`.

7. `providers/`, `contexts/`
   - `providers/`: app-level wrappers.
   - `contexts/`: global state nhẹ, không nhồi business logic.

8. `lib/`, `utils/`, `types/`, `config/`
   - `lib/`: setup hạ tầng/thư viện ngoài.
   - `utils/`: hàm thuần.
   - `types/`: shared types.
   - `config/`: env, routes, permissions.

### A3) Luồng import
- `pages/*` → chỉ import `features/*` và `components/layout`
- `features/*` → import `hooks/*`, `domains/*`, `components/*`
- `components/*` → chỉ import `utils/*`, `types/*`
- `domains/*` → import `services/*`, `types/*`, `utils/*`, `lib/react-query`
- `services/*` → import `lib/http/*`, `config/*`, `types/*`
- `lib/*` → import `config/*`

### A4) Next.js rules
- Luôn dùng `next/link` cho routing nội bộ.
- Luôn dùng `next/image` cho ảnh khi phù hợp.
- Phải check SSR safety trước khi dùng `window`/`document`.
- Component nặng dùng `next/dynamic` khi cần.
- Không hardcode URL, dùng `config/env.ts` hoặc `config/routes.ts`.

### A5) UI rules
- Tailwind: layout, spacing, responsive, typography, tokens.
- Ant Design: Form, Modal, Table, Drawer, Dropdown, DatePicker, Upload, Notification/Message.
- Không bọc chồng chéo vô nghĩa quanh AntD.

### A6) TypeScript & code style
- Không dùng `any`.
- Hạn chế `unknown`, ưu tiên type/interface rõ ràng.
- Mỗi file 1 trách nhiệm.
- Không gộp routing + logic + API trong cùng file.

---

## BACKEND GLOBAL RULES (PRODUCTION)

### 0) Nguyên tắc chung
- Tuyệt đối không thay đổi cấu trúc thư mục hiện tại.
- Chỉ tạo/chỉnh sửa file cần thiết.
- Mỗi file 1 trách nhiệm.
- Không hardcode config/secret/URL.
- Không try/catch tràn lan, ưu tiên error handler tập trung.
- Validate input mọi endpoint.
- Không log thông tin nhạy cảm.

### 1) Cấu trúc bắt buộc
```text
src/
├─ bootstrap/
├─ config/
├─ infra/
├─ middlewares/
├─ modules/
│  └─ <domain>/
│     ├─ repos/
│     ├─ *.controller.js
│     ├─ *.service.js
│     ├─ *.routes.js
│     └─ *.validate.js
└─ routes.js
```

### 2) Luồng xử lý bắt buộc
- HTTP: `Request → Middleware → Controller → Service → Repo → Service → Controller → Response`
- Socket: `Socket → Service → Repo`
- Không query DB trong controller/middleware.
- Không xử lý business logic trong routes.

### 3) Quy tắc cho từng phần
- `routes.js`: chỉ mount route/global middleware.
- `modules/<domain>/*.routes.js`: chỉ khai báo endpoint + middleware order.
- `*.validate.js`: chỉ validate request.
- `middlewares/`: chỉ cross-cutting concerns.
- `*.controller.js`: nhận req, gọi service, trả response.
- `*.service.js`: chứa business logic, không dùng `req/res`.
- `repos/*`: chỉ làm việc với DB.
- `infra/`: DB client, security helpers, logger, error classes.
- `config/`: đọc env và export config object.
- `bootstrap/`: tạo app, mount middleware, start server.

### 4) Error handling
- Dùng error handler tập trung.
- Không leak stack trace ở production.
- Mọi lỗi phải có `code` rõ ràng.

### 5) Security
- Password: bcrypt hash + compare.
- JWT verify ở middleware auth.
- Không trả field nhạy cảm.
- Validate body/query/params cho mọi endpoint.
- Không hardcode secret hoặc DB URL.

---

## Auction-only Decommission Rules
- Hệ thống hiện chỉ tập trung vào `auction notice`.
- Luồng `org-selection` đã decommission, không được crawl tự động lại nếu chưa có yêu cầu mới.
- Dashboard/API/admin không được phụ thuộc vào metric `org-selection`.
- Khi cần giữ traceability, ưu tiên comment rõ ràng thay vì xoá sạch logic ngay lập tức.

## Output Requirements
Khi xử lý yêu cầu kỹ thuật, luôn theo thứ tự:
1. Danh sách file sẽ tạo/chỉnh sửa.
2. Luồng xử lý ngắn theo kiến trúc.
3. Code đúng file đúng trách nhiệm.
4. Không giải thích lan man. Không đề xuất kiến trúc mới.
