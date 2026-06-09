import { NextResponse } from "next/server";
import { sql, ensureSchema, userOwnsTask } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { DEFAULT_STATUS, TASK_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cập nhật 1 task (chỉ khi task thuộc dự án của mình)
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await userOwnsTask(id, userId))) {
      return NextResponse.json(
        { error: "Không tìm thấy task" },
        { status: 404 }
      );
    }
    const body = await request.json();
    const customer_task = (body.customer_task ?? "").trim();
    const question = body.question ?? "";
    const customer_answer = body.customer_answer ?? "";
    const solution = body.solution ?? "";
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
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json({ task: rows[0] });
  } catch (e) {
    console.error("Update task error:", e);
    return serverError(e);
  }
}

// Cập nhật nhanh chỉ trạng thái
export async function PATCH(request, { params }) {
  try {
    await ensureSchema();
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await userOwnsTask(id, userId))) {
      return NextResponse.json(
        { error: "Không tìm thấy task" },
        { status: 404 }
      );
    }
    const { status } = await request.json();
    if (!TASK_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ" },
        { status: 400 }
      );
    }
    const rows = await sql`
      UPDATE tasks
      SET status = ${status}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json({ task: rows[0] });
  } catch (e) {
    console.error("Patch task error:", e);
    return serverError(e);
  }
}

// Xóa task (chỉ khi task thuộc dự án của mình)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    if (!(await userOwnsTask(id, userId))) {
      return NextResponse.json(
        { error: "Không tìm thấy task" },
        { status: 404 }
      );
    }
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete task error:", e);
    return serverError(e);
  }
}
