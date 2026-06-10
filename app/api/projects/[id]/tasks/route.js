import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessProject } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeLink, normalizeDate } from "@/lib/api";
import { DEFAULT_STATUS, TASK_STATUSES, DEFAULT_PRIORITY } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách task của 1 dự án (admin xem được mọi dự án)
export async function GET(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const projectId = Number(params.id);
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    const rows = await sql`
      SELECT id, project_id, customer_task, question, customer_answer, solution,
             status, doc_link, end_date::text AS end_date, completed_at, priority,
             created_at, updated_at
      FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ tasks: rows });
  } catch (e) {
    return serverError(e);
  }
}

// Tạo task mới trong dự án (admin thêm được vào mọi dự án)
export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const projectId = Number(params.id);
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    const body = await request.json();
    const customer_task = (body.customer_task || "").trim();
    const question = body.question || "";
    const customer_answer = body.customer_answer || "";
    const solution = body.solution || "";
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

    const rows = await sql`
      INSERT INTO tasks (project_id, customer_task, question, customer_answer, solution, status, end_date, doc_link, priority, completed_at)
      VALUES (${projectId}, ${customer_task}, ${question}, ${customer_answer}, ${solution}, ${status}, ${end_date}, ${doc_link}, ${priority},
              CASE WHEN ${status} = 'Hoàn thành' THEN now() ELSE NULL END)
      RETURNING id, project_id, customer_task, question, customer_answer, solution,
                status, doc_link, end_date::text AS end_date, completed_at, priority,
                created_at, updated_at
    `;
    return NextResponse.json({ task: rows[0] }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
