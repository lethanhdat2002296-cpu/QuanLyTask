import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { DEFAULT_STATUS, TASK_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách task của 1 dự án
export async function GET(_request, { params }) {
  try {
    await ensureSchema();
    const projectId = Number(params.id);
    const rows = await sql`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ tasks: rows });
  } catch (e) {
    console.error("List tasks error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Tạo task mới trong dự án
export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const projectId = Number(params.id);
    const body = await request.json();
    const customer_task = (body.customer_task || "").trim();
    const question = body.question || "";
    const customer_answer = body.customer_answer || "";
    const solution = body.solution || "";
    let status = body.status || DEFAULT_STATUS;
    if (!TASK_STATUSES.includes(status)) status = DEFAULT_STATUS;

    if (!customer_task) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung Task khách hàng" },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO tasks (project_id, customer_task, question, customer_answer, solution, status)
      VALUES (${projectId}, ${customer_task}, ${question}, ${customer_answer}, ${solution}, ${status})
      RETURNING *
    `;
    return NextResponse.json({ task: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("Create task error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
