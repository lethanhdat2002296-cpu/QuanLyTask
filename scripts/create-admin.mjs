// Tạo (hoặc nâng cấp) một tài khoản ADMIN toàn quyền.
// Chạy: npm run create-admin -- <tên_đăng_nhập> <mật_khẩu> [email]
// Ví dụ: npm run create-admin -- admin MatKhauManh123 admin@example.com
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

const [username, password, email] = process.argv.slice(2);
if (!username || !password) {
  console.error("Cách dùng: npm run create-admin -- <tên_đăng_nhập> <mật_khẩu> [email]");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      token_version INTEGER NOT NULL DEFAULT 0,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`;

  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (username, password_hash, email, is_admin)
    VALUES (${username}, ${hash}, ${email ? email.toLowerCase() : null}, true)
    ON CONFLICT (username)
    DO UPDATE SET password_hash = EXCLUDED.password_hash,
                  email = COALESCE(EXCLUDED.email, users.email),
                  is_admin = true,
                  token_version = users.token_version + 1
  `;
  console.log(`✅ Đã tạo/nâng cấp ADMIN: ${username}${email ? " (email: " + email + ")" : ""}`);
}

main().catch((e) => {
  console.error("❌ Lỗi:", e.message);
  process.exit(1);
});
