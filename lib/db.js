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

// Tạo bảng + cột nếu chưa có. Gọi idempotent, chỉ chạy 1 lần mỗi tiến trình.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    // Tối ưu khởi động nguội: nếu schema đã đủ (cột mới nhất tồn tại) thì bỏ qua
    // toàn bộ lệnh tạo bảng -> chỉ tốn 1 truy vấn thay vì ~12.
    // LƯU Ý: probe phải là CỘT MỚI NHẤT vừa thêm. Hiện tại: tasks.doc_link.
    try {
      await sql`SELECT doc_link FROM tasks LIMIT 0`;
      return; // schema đã sẵn sàng
    } catch {
      // chưa đủ -> chạy migration đầy đủ bên dưới
    }

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
    // Cho DB cũ đã tạo trước khi có cột email / token_version / is_admin
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`;
    // Email là duy nhất (không phân biệt hoa thường). Bọc try để không phá app nếu DB cũ có email trùng.
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users (LOWER(email)) WHERE email IS NOT NULL`;
    } catch (e) {
      console.error("Không tạo được unique index email (có thể do dữ liệu trùng cũ):", e.message);
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
    // Cho DB cũ đã tạo projects trước khi có cột user_id
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
        end_date DATE,
        doc_link TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Cho DB cũ đã tạo tasks trước khi có 2 cột này
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date DATE`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS doc_link TEXT NOT NULL DEFAULT ''`;

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
  })().catch((err) => {
    // Không nhớ lần chạy thất bại: xóa cache để request sau thử lại (các câu lệnh đều idempotent)
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

// Kiểm tra user có sở hữu dự án không
export async function userOwnsProject(projectId, userId) {
  const rows = await sql`
    SELECT 1 FROM projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

// Kiểm tra user có sở hữu task không (qua dự án cha)
export async function userOwnsTask(taskId, userId) {
  const rows = await sql`
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = ${taskId} AND p.user_id = ${userId}
  `;
  return rows.length > 0;
}

// Quyền truy cập dự án: admin được mọi dự án (chỉ cần tồn tại), người thường cần sở hữu
export async function canAccessProject(projectId, auth) {
  if (auth.isAdmin) {
    const rows = await sql`SELECT 1 FROM projects WHERE id = ${projectId}`;
    return rows.length > 0;
  }
  return userOwnsProject(projectId, auth.id);
}

// Quyền truy cập task: admin được mọi task (chỉ cần tồn tại), người thường cần sở hữu
export async function canAccessTask(taskId, auth) {
  if (auth.isAdmin) {
    const rows = await sql`SELECT 1 FROM tasks WHERE id = ${taskId}`;
    return rows.length > 0;
  }
  return userOwnsTask(taskId, auth.id);
}
