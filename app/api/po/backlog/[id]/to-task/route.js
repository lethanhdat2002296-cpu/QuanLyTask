import { NextResponse } from "next/server";
import { sql, ensureSchema, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chuyển 1 hạng mục backlog (PO) thành task thực thi (BA) — nối chuỗi giá trị
// từ ý tưởng sản phẩm sang việc giao cho khách. Mỗi hạng mục chỉ tạo 1 task.
export async function POST(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const rows = auth.isAdmin
      ? await sql`SELECT b.*, p.name AS project_name FROM backlog_items b JOIN projects p ON p.id = b.project_id WHERE b.id = ${id}`
      : await sql`
          SELECT b.*, p.name AS project_name FROM backlog_items b
          JOIN projects p ON p.id = b.project_id
          WHERE b.id = ${id} AND p.user_id = ${auth.id}
        `;
    const item = rows[0];
    if (!item) {
      return NextResponse.json(
        { error: "Không tìm thấy hạng mục" },
        { status: 404 }
      );
    }

    // Đã có task gắn rồi và task còn tồn tại -> không tạo trùng
    if (item.task_id) {
      const existed = await sql`SELECT id FROM tasks WHERE id = ${item.task_id}`;
      if (existed.length) {
        return NextResponse.json(
          { error: "Hạng mục này đã có task BA rồi." },
          { status: 409 }
        );
      }
    }

    // Nội dung task: gom user story + tiêu chí chấp nhận + ghi chú của backlog
    const parts = [];
    if (item.user_story) parts.push(item.user_story);
    if (item.acceptance_criteria)
      parts.push("Tiêu chí chấp nhận:\n" + item.acceptance_criteria);
    if (item.note) parts.push("Ghi chú: " + item.note);
    const customerTask = parts.join("\n\n");
    // Ưu tiên task lấy theo giá trị kinh doanh của hạng mục (1=Cao..3=Thấp — cùng thang)
    const priority = [1, 2, 3].includes(Number(item.business_value))
      ? Number(item.business_value)
      : 2;

    const taskRows = await sql`
      INSERT INTO tasks (project_id, title, customer_task, priority, status)
      VALUES (${item.project_id}, ${String(item.title).slice(0, 150)},
              ${customerTask}, ${priority}, 'Mới')
      RETURNING id, title
    `;
    const task = taskRows[0];

    // Gắn ngược task vào hạng mục; hạng mục "Đã duyệt" thì chuyển sang "Đang làm"
    const updated = await sql`
      UPDATE backlog_items
      SET task_id = ${task.id},
          status = CASE WHEN status IN ('Ý tưởng', 'Đã duyệt') THEN 'Đang làm' ELSE status END,
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    await logActivity({
      taskId: task.id,
      userId: auth.id,
      projectId: item.project_id,
      projectName: item.project_name,
      taskLabel: item.title,
      action: "po_backlog_to_task",
    });

    return NextResponse.json(
      { ok: true, task_id: task.id, project_id: item.project_id, item: updated[0] },
      { status: 201 }
    );
  } catch (e) {
    return serverError(e);
  }
}
