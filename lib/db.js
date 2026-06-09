import { neon } from "@neondatabase/serverless";

let _client = null;

// Chỉ tạo kết nối khi thực sự cần (lúc chạy request), KHÔNG tạo lúc build/import.
// Nhờ vậy `next build` trên Vercel không crash dù chưa có biến môi trường.
function getClient() {
  if (_client) return _client;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Thiếu biến môi trường DATABASE_URL. Hãy tạo file .env.local (local) hoặc thêm biến môi trường trên Vercel."
    );
  }
  _client = neon(process.env.DATABASE_URL);
  return _client;
}

// sql`...` trả về mảng các dòng kết quả. Dùng cho truy vấn Postgres trên Neon.
export function sql(strings, ...values) {
  return getClient()(strings, ...values);
}

let schemaReady = null;

// Tạo bảng nếu chưa có. Gọi idempotent, chỉ chạy 1 lần mỗi tiến trình.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
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
  })();
  return schemaReady;
}
