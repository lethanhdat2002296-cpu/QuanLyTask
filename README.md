# 📋 Quản Lý Task

Web quản lý dự án và task khách hàng, xây bằng **Next.js** + **Neon Postgres**.

Mỗi **dự án** chứa nhiều **task**, mỗi task gồm:

- **Task khách hàng** – yêu cầu khách đưa ra
- **Đặt câu hỏi** – câu hỏi cần làm rõ
- **Khách trả lời** – phản hồi của khách
- **Giải pháp** – hướng giải quyết
- **Trạng thái** – Mới / Đang xử lý / Chờ khách phản hồi / Đã có giải pháp / Hoàn thành

Tính năng tài khoản:

- **Đăng nhập** bảo vệ toàn bộ ứng dụng
- **Đăng ký** tài khoản mới (cần **mã mời** bí mật)
- **Quên mật khẩu** – gửi link đặt lại qua email
- **Dữ liệu riêng từng người** – mỗi người chỉ thấy dự án/task của mình

---

## 1. Cài đặt

```bash
npm install
```

## 2. Cấu hình biến môi trường

Tạo file `.env.local` ở thư mục gốc (tham khảo `.env.example`):

```env
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
JWT_SECRET="một-chuỗi-ngẫu-nhiên-dài"
INVITE_CODE="mã-bí-mật-để-đăng-ký"
APP_URL="http://localhost:3000"

# Gửi email quên mật khẩu (ví dụ Gmail App Password)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="email-cua-ban@gmail.com"
SMTP_PASS="app-password-16-ky-tu"
SMTP_FROM="Quản Lý Task <email-cua-ban@gmail.com>"
```

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối Neon Postgres |
| `JWT_SECRET` | ✅ | Khóa ký token đăng nhập |
| `INVITE_CODE` | ✅ (để bật đăng ký) | Mã bí mật, ai biết mới đăng ký được |
| `APP_URL` | nên có | URL gốc để tạo link trong email (an toàn hơn header) |
| `SMTP_*` | cho quên mật khẩu | Cấu hình gửi email; thiếu thì chức năng quên MK báo "chưa cấu hình" |

> Tạo `JWT_SECRET` ngẫu nhiên:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
> ```

> **Gmail App Password**: bật xác minh 2 bước cho Gmail → vào Google Account → Security → App passwords → tạo mật khẩu ứng dụng 16 ký tự, dán vào `SMTP_PASS`.

⚠️ **Không bao giờ commit file `.env.local`** (đã được `.gitignore` bỏ qua).

## 3. Tạo bảng trong database

```bash
npm run init-db
```

## 4. Tạo tài khoản

Có 2 cách:

- **Qua web**: mở trang `/register`, nhập **mã mời** (`INVITE_CODE`) để tạo tài khoản.
- **Qua lệnh** (dành cho admin / tạo nhanh):
  ```bash
  npm run create-user -- <tên_đăng_nhập> <mật_khẩu> [email]
  # Ví dụ:
  npm run create-user -- admin MatKhau123 admin@example.com
  ```
  Chạy lại với cùng tên đăng nhập sẽ **đặt lại mật khẩu** (và thu hồi các phiên cũ).

## 5. Chạy ở máy (local)

```bash
npm run dev
```

Mở http://localhost:3000 → đăng nhập hoặc đăng ký.

---

## Deploy lên Vercel (chạy online)

1. Đẩy code lên GitHub (đã làm sẵn).
2. Vào https://vercel.com → **Add New → Project** → chọn repo `QuanLyTask`.
3. Ở mục **Environment Variables**, thêm các biến ở bảng trên (ít nhất `DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`; đặt `APP_URL` = URL Vercel của bạn; thêm `SMTP_*` nếu cần quên mật khẩu).
4. Bấm **Deploy**.
5. Tài khoản đăng ký trên web (cùng database Neon) dùng được cả local và online.

> File `vercel.json` đã ép `framework: nextjs` để Vercel build đúng kiểu Next.js.

---

## Bảo mật (đã áp dụng)

- Mật khẩu băm bằng **bcrypt**; SQL **parameterized** (không injection).
- Phân quyền theo người dùng kiểm tra ở server mọi request (không IDOR).
- Token đặt lại mật khẩu: ngẫu nhiên 256-bit, lưu **hash**, hết hạn 1 giờ, dùng 1 lần.
- Đổi mật khẩu **thu hồi mọi phiên cũ** (token_version).
- Email là duy nhất (không phân biệt hoa thường); thông báo lỗi không lộ tài khoản tồn tại.

Hạn chế còn lại (có thể bổ sung sau): chưa có rate-limit theo IP cho đăng nhập (mới chặn gửi dồn email quên mật khẩu).

---

## Cấu trúc thư mục

```
app/
  login, register, forgot-password, reset-password   Các trang tài khoản
  page.js                    Trang chính: danh sách & tạo dự án
  projects/[id]/page.js      Chi tiết dự án & quản lý task
  api/auth/...               login, register, logout, me, forgot/reset password
  api/projects, api/tasks    CRUD dự án & task (lọc theo người dùng)
components/                  Topbar, TaskModal
lib/
  db.js                      Kết nối Neon + tạo bảng + kiểm tra sở hữu
  auth.js                    Đăng nhập JWT cookie + thu hồi phiên
  email.js                   Gửi email đặt lại mật khẩu (SMTP)
  api.js                     Helper lỗi máy chủ
  constants.js               Danh sách trạng thái task
scripts/
  init-db.mjs                Tạo bảng
  create-user.mjs            Tạo tài khoản
middleware.js                Chặn truy cập khi chưa đăng nhập
```

## Tùy chỉnh trạng thái task

Sửa danh sách trong `lib/constants.js` (`TASK_STATUSES` và `STATUS_COLORS`).
