// Tạo các bảng + cột trong database Neon.
// Chạy: npm run init-db
import { neon } from "@neondatabase/serverless";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Không sao nếu chạy trên môi trường đã có sẵn biến môi trường (vd: Vercel)
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Thiếu DATABASE_URL. Hãy tạo file .env.local (xem .env.example).");
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`;
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users (LOWER(email)) WHERE email IS NOT NULL`;
  } catch (e) {
    console.warn("⚠️  Bỏ qua unique index email (có thể do email trùng cũ):", e.message);
  }

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      customer_task TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL DEFAULT '',
      customer_answer TEXT NOT NULL DEFAULT '',
      solution TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Mới',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash)`;

  console.log("✅ Đã tạo xong bảng: users, projects, tasks, password_reset_tokens");
}

main().catch((e) => {
  console.error("❌ Lỗi:", e.message);
  process.exit(1);
});
