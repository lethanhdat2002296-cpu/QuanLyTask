# 📋 Quản Lý Task

Web quản lý dự án và task khách hàng, xây bằng **Next.js** + **Neon Postgres**.

Mỗi **dự án** chứa nhiều **task**, mỗi task gồm:

- **Task khách hàng** – yêu cầu khách đưa ra
- **Đặt câu hỏi** – câu hỏi cần làm rõ
- **Khách trả lời** – phản hồi của khách
- **Giải pháp** – hướng giải quyết
- **Trạng thái** – Mới / Đang xử lý / Chờ khách phản hồi / Đã có giải pháp / Hoàn thành

Có **đăng nhập** bảo vệ toàn bộ ứng dụng.

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
```

> Tạo `JWT_SECRET` ngẫu nhiên:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
> ```

⚠️ **Không bao giờ commit file `.env.local`** (đã được `.gitignore` bỏ qua).

## 3. Tạo bảng trong database

```bash
npm run init-db
```

## 4. Tạo tài khoản đăng nhập (bạn tự đặt user/pass)

```bash
npm run create-user -- <tên_đăng_nhập> <mật_khẩu>
# Ví dụ:
npm run create-user -- admin MatKhau123
```

Chạy lại lệnh trên với cùng tên đăng nhập sẽ **đặt lại mật khẩu**.

## 5. Chạy ở máy (local)

```bash
npm run dev
```

Mở http://localhost:3000 → đăng nhập bằng tài khoản vừa tạo.

---

## Deploy lên Vercel (chạy online)

1. Đẩy code lên GitHub (đã làm sẵn).
2. Vào https://vercel.com → **Add New → Project** → chọn repo `QuanLyTask`.
3. Ở mục **Environment Variables**, thêm:
   - `DATABASE_URL` = chuỗi kết nối Neon
   - `JWT_SECRET` = chuỗi bí mật
4. Bấm **Deploy**.
5. Sau khi deploy, mở terminal local và chạy `npm run init-db` + `npm run create-user` (vẫn dùng chung database Neon nên tài khoản dùng được luôn).

---

## Cấu trúc thư mục

```
app/
  login/page.js              Trang đăng nhập
  page.js                    Trang chính: danh sách & tạo dự án
  projects/[id]/page.js      Chi tiết dự án & quản lý task
  api/                       API: auth, projects, tasks
components/                  Topbar, TaskModal
lib/
  db.js                      Kết nối Neon + tạo bảng
  auth.js                    Đăng nhập bằng JWT cookie
  constants.js               Danh sách trạng thái task
scripts/
  init-db.mjs                Tạo bảng
  create-user.mjs            Tạo tài khoản
middleware.js                Chặn truy cập khi chưa đăng nhập
```

## Tùy chỉnh trạng thái task

Sửa danh sách trong `lib/constants.js` (`TASK_STATUSES` và `STATUS_COLORS`).
