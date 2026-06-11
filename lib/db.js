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
    // LƯU Ý: probe phải là CẤU TRÚC MỚI NHẤT. Hiện tại: cột backlog_items.notion_page_id.
    try {
      await sql`SELECT notion_page_id FROM backlog_items LIMIT 0`;
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
        reference_docs TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Cho DB cũ đã tạo projects trước khi có cột user_id / reference_docs
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
    // Tài liệu tham khảo của dự án (người dùng dán văn bản; AI dùng làm ngữ cảnh gợi ý)
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS reference_docs TEXT NOT NULL DEFAULT ''`;

    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        customer_task TEXT NOT NULL DEFAULT '',
        question TEXT NOT NULL DEFAULT '',
        customer_answer TEXT NOT NULL DEFAULT '',
        solution TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Mới',
        end_date DATE,
        doc_link TEXT NOT NULL DEFAULT '',
        completed_at TIMESTAMPTZ,
        priority SMALLINT NOT NULL DEFAULT 2,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Cho DB cũ đã tạo tasks trước khi có các cột này
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date DATE`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS doc_link TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 2`;
    // ID page Notion đã xuất (để lần sau CẬP NHẬT page cũ thay vì tạo mới)
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notion_page_id TEXT`;
    // Backfill: task đã Hoàn thành mà chưa có mốc thời gian thì lấy updated_at
    await sql`UPDATE tasks SET completed_at = updated_at WHERE status = 'Hoàn thành' AND completed_at IS NULL`;
    // Index cho truy vấn backlog xuyên dự án
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;

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

    // Nhật ký hoạt động (dòng thời gian). Lưu kèm project_name + task_label để
    // dòng feed vẫn hiển thị được cả khi task/dự án bị xóa.
    await sql`
      CREATE TABLE IF NOT EXISTS task_activity_log (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        project_id INTEGER,
        project_name TEXT,
        task_label TEXT,
        action TEXT NOT NULL,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_user ON task_activity_log(user_id, created_at DESC)`;

    // ===== Chế độ PO =====
    // Giai đoạn phát triển phần mềm — mỗi dự án có bộ giai đoạn riêng (GĐ1 MVP, GĐ2...)
    await sql`
      CREATE TABLE IF NOT EXISTS phases (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        start_date DATE,
        end_date DATE,
        status TEXT NOT NULL DEFAULT 'Chưa bắt đầu',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id)`;

    // Backlog sản phẩm — hạng mục/tính năng với user story, tiêu chí chấp nhận,
    // giá trị kinh doanh (1=Cao..3=Thấp), công sức (1=Nhỏ..3=Lớn), nhóm now/next/later.
    await sql`
      CREATE TABLE IF NOT EXISTS backlog_items (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        user_story TEXT NOT NULL DEFAULT '',
        acceptance_criteria TEXT NOT NULL DEFAULT '',
        business_value SMALLINT NOT NULL DEFAULT 2,
        effort SMALLINT NOT NULL DEFAULT 2,
        bucket TEXT NOT NULL DEFAULT 'next',
        status TEXT NOT NULL DEFAULT 'Ý tưởng',
        sort_order INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`ALTER TABLE backlog_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE backlog_items ADD COLUMN IF NOT EXISTS notion_page_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_backlog_project ON backlog_items(project_id)`;
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

// Ghi 1 dòng nhật ký hoạt động. BEST-EFFORT: lỗi ghi log KHÔNG làm hỏng thao tác chính.
export async function logActivity({
  taskId = null,
  userId = null,
  projectId = null,
  projectName = null,
  taskLabel = null,
  action,
  field = null,
  oldValue = null,
  newValue = null,
}) {
  try {
    const label = taskLabel ? String(taskLabel).slice(0, 160) : null;
    await sql`
      INSERT INTO task_activity_log
        (task_id, user_id, project_id, project_name, task_label, action, field, old_value, new_value)
      VALUES
        (${taskId}, ${userId}, ${projectId}, ${projectName}, ${label}, ${action}, ${field}, ${oldValue}, ${newValue})
    `;
  } catch (e) {
    console.error("logActivity lỗi (bỏ qua):", e.message);
  }
}
