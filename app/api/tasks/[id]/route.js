import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessTask, logActivity } from "@/lib/db";
import { syncTaskToSheet, deleteTaskFromSheet } from "@/lib/google";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeLink, normalizeDate } from "@/lib/api";
import { DEFAULT_STATUS, TASK_STATUSES, DEFAULT_PRIORITY } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lấy thông tin task hiện tại (trước khi sửa) để ghi nhật ký
async function taskBefore(id) {
  const rows = await sql`
    SELECT t.status, t.project_id, t.customer_task, p.name AS project_name
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = ${id}
  `;
  return rows[0] || null;
}

// Cập nhật 1 task (admin sửa được mọi task)
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await canAccessTask(id, auth))) {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    const body = await request.json();
    const customer_task = (body.customer_task ?? "").trim();
    const question = body.question ?? "";
    const customer_answer = body.customer_answer ?? "";
    const solution = body.solution ?? "";
    const end_date = normalizeDate(body.end_date);
    const doc_link = normalizeLink(body.doc_link);
    let status = body.status || DEFAULT_STATUS;
    if (!TASK_STATUSES.includes(status)) status = DEFAULT_STATUS;
    let priority = Number(body.priority);
    if (![1, 2, 3].includes(priority)) priority = DEFAULT_PRIORITY;

    if (!customer_task) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung Task khách hàng" },
        { status: 400 }
      );
    }

    const before = await taskBefore(id);
    const rows = await sql`
      UPDATE tasks
      SET customer_task = ${customer_task},
          question = ${question},
          customer_answer = ${customer_answer},
          solution = ${solution},
          status = ${status},
          end_date = ${end_date},
          doc_link = ${doc_link},
          priority = ${priority},
          completed_at = CASE
            WHEN ${status} = 'Hoàn thành' AND completed_at IS NULL THEN now()
            WHEN ${status} <> 'Hoàn thành' THEN NULL
            ELSE completed_at
          END,
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, project_id, customer_task, question, customer_answer, solution,
                status, doc_link, end_date::text AS end_date, completed_at, priority,
                created_at, updated_at
    `;
    if (before && before.status !== status) {
      await logActivity({
        taskId: id,
        userId: auth.id,
        projectId: before.project_id,
        projectName: before.project_name,
        taskLabel: customer_task,
        action: "status_change",
        field: "status",
        oldValue: before.status,
        newValue: status,
      });
    }
    await syncTaskToSheet(rows[0], before?.project_name);
    return NextResponse.json({ task: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Cập nhật nhanh chỉ trạng thái
export async function PATCH(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await canAccessTask(id, auth))) {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    const { status } = await request.json();
    if (!TASK_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }
    const before = await taskBefore(id);
    const rows = await sql`
      UPDATE tasks
      SET status = ${status},
          completed_at = CASE
            WHEN ${status} = 'Hoàn thành' AND completed_at IS NULL THEN now()
            WHEN ${status} <> 'Hoàn thành' THEN NULL
            ELSE completed_at
          END,
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, project_id, customer_task, question, customer_answer, solution,
                status, doc_link, end_date::text AS end_date, completed_at, priority,
                created_at, updated_at
    `;
    if (before && before.status !== status) {
      await logActivity({
        taskId: id,
        userId: auth.id,
        projectId: before.project_id,
        projectName: before.project_name,
        taskLabel: before.customer_task,
        action: "status_change",
        field: "status",
        oldValue: before.status,
        newValue: status,
      });
    }
    await syncTaskToSheet(rows[0], before?.project_name);
    return NextResponse.json({ task: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Xóa task (admin xóa được mọi task)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await canAccessTask(id, auth))) {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    const before = await taskBefore(id);
    if (before) {
      await logActivity({
        taskId: id,
        userId: auth.id,
        projectId: before.project_id,
        projectName: before.project_name,
        taskLabel: before.customer_task,
        action: "delete",
      });
    }
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    await deleteTaskFromSheet(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
