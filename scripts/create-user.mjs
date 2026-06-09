// Tạo (hoặc đặt lại mật khẩu) tài khoản đăng nhập.
// Chạy: npm run create-user -- <tên_đăng_nhập> <mật_khẩu>
// Ví dụ: npm run create-user -- admin MatKhau123
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // bỏ qua nếu đã có sẵn biến môi trường
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Thiếu DATABASE_URL. Hãy tạo file .env.local (xem .env.example).");
  process.exit(1);
}

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Cách dùng: npm run create-user -- <tên_đăng_nhập> <mật_khẩu>");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  // Đảm bảo bảng users đã tồn tại
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${hash})
    ON CONFLICT (username)
    DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
  console.log(`✅ Đã tạo/cập nhật tài khoản: ${username}`);
}

main().catch((e) => {
  console.error("❌ Lỗi:", e.message);
  process.exit(1);
});
