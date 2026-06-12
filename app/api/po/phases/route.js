import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessProject, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeDate, isInvalidDateInput } from "@/lib/api";
import { PHASE_STATUSES, DEFAULT_PHASE_STATUS } from "@/lib/constants";

// start phải <= end (khi cả hai cùng có)
function badDateRange(start, end) {
  return Boolean(start && end && String(start) > String(end));
}

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
    const sp = new URL(request.url).searchParams;

    // Chế độ ?all=1: trả giai đoạn của MỌI dự án user sở hữu trong MỘT truy vấn
    // (cho trang Roadmap — tránh N+1 request theo từng dự án).
    if (sp.get("all") === "1") {
      const phases = await sql`
        SELECT ph.id, ph.project_id, p.name AS project_name, ph.name, ph.goal,
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
        JOIN projects p ON p.id = ph.project_id
        LEFT JOIN backlog_items b ON b.phase_id = ph.id
        WHERE (${auth.isAdmin} OR p.user_id = ${auth.id})
        GROUP BY ph.id, p.id
        ORDER BY MIN(p.created_at) DESC, ph.start_date ASC NULLS LAST, ph.created_at ASC
      `;
      return NextResponse.json({ phases });
    }

    const projectId = Number(sp.get("project"));
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
    if (isInvalidDateInput(body.start_date) || isInvalidDateInput(body.end_date)) {
      return NextResponse.json(
        { error: "Ngày không hợp lệ (định dạng YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const startDate = normalizeDate(body.start_date);
    const endDate = normalizeDate(body.end_date);
    if (badDateRange(startDate, endDate)) {
      return NextResponse.json(
        { error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" },
        { status: 400 }
      );
    }
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
