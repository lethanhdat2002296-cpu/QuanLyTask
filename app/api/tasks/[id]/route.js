import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessTask } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeLink, normalizeDate } from "@/lib/api";
import { DEFAULT_STATUS, TASK_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (!customer_task) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung Task khách hàng" },
        { status: 400 }
      );
    }

    const rows = await sql`
      UPDATE tasks
      SET customer_task = ${customer_task},
          question = ${question},
          customer_answer = ${customer_answer},
          solution = ${solution},
          status = ${status},
          end_date = ${end_date},
          doc_link = ${doc_link},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, project_id, customer_task, question, customer_answer, solution,
                status, doc_link, end_date::text AS end_date, created_at, updated_at
    `;
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
    const rows = await sql`
      UPDATE tasks
      SET status = ${status}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, project_id, customer_task, question, customer_answer, solution,
                status, doc_link, end_date::text AS end_date, created_at, updated_at
    `;
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
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
