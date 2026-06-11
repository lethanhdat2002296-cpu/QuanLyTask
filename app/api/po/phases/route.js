import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessProject, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeDate } from "@/lib/api";
import { PHASE_STATUSES, DEFAULT_PHASE_STATUS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách giai đoạn phát triển của 1 dự án (kèm tiến độ: số hạng mục đã hoàn thành).
// GET /api/po/phases?project=<id>
export async function GET(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const projectId = Number(new URL(request.url).searchParams.get("project"));
    if (!projectId) {
      return NextResponse.json({ error: "Thiếu dự án" }, { status: 400 });
    }
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const phases = await sql`
      SELECT ph.id, ph.project_id, ph.name, ph.goal,
             ph.start_date::text AS start_date, ph.end_date::text AS end_date,
             ph.status, ph.created_at,
             COUNT(b.id)::int AS item_count,
             (COUNT(b.id) FILTER (WHERE b.status = 'Hoàn thành'))::int AS done_count,
             COALESCE(SUM(b.effort), 0)::int AS total_effort,
             COALESCE(SUM(b.effort) FILTER (WHERE b.status = 'Hoàn thành'), 0)::int AS done_effort,
             (ph.end_date IS NOT NULL
              AND ph.end_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              AND ph.status <> 'Hoàn thành') AS is_overdue
      FROM phases ph
      LEFT JOIN backlog_items b ON b.phase_id = ph.id
      WHERE ph.project_id = ${projectId}
      GROUP BY ph.id
      ORDER BY ph.start_date ASC NULLS LAST, ph.created_at ASC
    `;
    return NextResponse.json({ phases });
  } catch (e) {
    return serverError(e);
  }
}

// Tạo giai đoạn mới. Body: { project_id, name, goal?, start_date?, end_date?, status? }
export async function POST(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const projectId = Number(body.project_id);
    const name = String(body.name || "").trim();
    if (!projectId) {
      return NextResponse.json({ error: "Thiếu dự án" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên giai đoạn" },
        { status: 400 }
      );
    }
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    const goal = String(body.goal || "");
    const startDate = normalizeDate(body.start_date);
    const endDate = normalizeDate(body.end_date);
    const status = PHASE_STATUSES.includes(body.status)
      ? body.status
      : DEFAULT_PHASE_STATUS;

    const rows = await sql`
      INSERT INTO phases (project_id, name, goal, start_date, end_date, status)
      VALUES (${projectId}, ${name.slice(0, 150)}, ${goal}, ${startDate}, ${endDate}, ${status})
      RETURNING id, project_id, name, goal,
                start_date::text AS start_date, end_date::text AS end_date,
                status, created_at
    `;
    const proj = await sql`SELECT name FROM projects WHERE id = ${projectId}`;
    await logActivity({
      userId: auth.id,
      projectId,
      projectName: proj[0]?.name,
      taskLabel: rows[0].name,
      action: "po_phase_create",
    });
    return NextResponse.json({ phase: rows[0] }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
