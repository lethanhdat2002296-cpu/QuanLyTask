// Tạo các bảng trong database Neon.
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
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
  console.log("✅ Đã tạo xong các bảng: users, projects, tasks");
}

main().catch((e) => {
  console.error("❌ Lỗi:", e.message);
  process.exit(1);
});
