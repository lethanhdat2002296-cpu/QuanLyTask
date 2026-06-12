import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessProject, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, escapeLike } from "@/lib/api";
import {
  BACKLOG_BUCKETS,
  BACKLOG_STATUSES,
  DEFAULT_BUCKET,
  DEFAULT_BACKLOG_STATUS,
} from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_VALUES = BACKLOG_BUCKETS.map((b) => b.value);

// Danh sách hạng mục backlog của user (admin xem tất cả).
// Lọc: ?project=&bucket=&status=&q=
export async function GET(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const sp = new URL(request.url).searchParams;
    const projectId = Number(sp.get("project")) || null;
    const bucketRaw = sp.get("bucket");
    const bucket = BUCKET_VALUES.includes(bucketRaw) ? bucketRaw : null;
    const statusRaw = sp.get("status");
    const status = BACKLOG_STATUSES.includes(statusRaw) ? statusRaw : null;
    const qRaw = (sp.get("q") || "").trim();
    const like = qRaw ? "%" + escapeLike(qRaw) + "%" : null;

    const items = await sql`
      SELECT b.id, b.project_id, p.name AS project_name,
             b.phase_id, ph.name AS phase_name,
             b.title, b.user_story, b.acceptance_criteria,
             b.business_value, b.effort, b.bucket, b.status, b.sort_order, b.note,
             b.task_id, b.created_at, b.updated_at
      FROM backlog_items b
      JOIN projects p ON p.id = b.project_id
      LEFT JOIN phases ph ON ph.id = b.phase_id
      WHERE (${auth.isAdmin} OR p.user_id = ${auth.id})
        AND (${projectId}::int IS NULL OR b.project_id = ${projectId})
        AND (${bucket}::text IS NULL OR b.bucket = ${bucket})
        AND (${status}::text IS NULL OR b.status = ${status})
        AND (${like}::text IS NULL OR (
             b.title ILIKE ${like} OR b.user_story ILIKE ${like} OR b.note ILIKE ${like}
        ))
      ORDER BY CASE b.bucket WHEN 'now' THEN 1 WHEN 'next' THEN 2 ELSE 3 END,
               b.project_id ASC,
               b.sort_order ASC, b.business_value ASC, b.effort ASC, b.created_at DESC
    `;
    return NextResponse.json({ items, isAdmin: auth.isAdmin });
  } catch (e) {
    return serverError(e);
  }
}

// Tạo hạng mục backlog.
// Body: { project_id, title, user_story?, acceptance_criteria?, business_value?,
//         effort?, bucket?, status?, phase_id?, note? }
export async function POST(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const projectId = Number(body.project_id);
    const title = String(body.title || "").trim();
    if (!projectId) {
      return NextResponse.json({ error: "Thiếu dự án" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json(
        { error: "Vui lòng nhập tiêu đề hạng mục" },
        { status: 400 }
      );
    }
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const businessValue = [1, 2, 3].includes(Number(body.business_value))
      ? Number(body.business_value)
      : 2;
    const effort = [1, 2, 3].includes(Number(body.effort))
      ? Number(body.effort)
      : 2;
    const bucket = BUCKET_VALUES.includes(body.bucket) ? body.bucket : DEFAULT_BUCKET;
    const status = BACKLOG_STATUSES.includes(body.status)
      ? body.status
      : DEFAULT_BACKLOG_STATUS;

    // Giai đoạn (nếu gắn) phải thuộc đúng dự án này
    let phaseId = Number(body.phase_id) || null;
    if (phaseId) {
      const ok = await sql`
        SELECT 1 FROM phases WHERE id = ${phaseId} AND project_id = ${projectId}
      `;
      if (!ok.length) {
        return NextResponse.json(
          { error: "Giai đoạn không thuộc dự án này" },
          { status: 400 }
        );
      }
    }

    const orderRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM backlog_items
      WHERE project_id = ${projectId} AND bucket = ${bucket}
    `;
    const sortOrder = Number(orderRows[0]?.next_order || 0);

    const rows = await sql`
      INSERT INTO backlog_items
        (project_id, phase_id, title, user_story, acceptance_criteria,
         business_value, effort, bucket, status, sort_order, note)
      VALUES
        (${projectId}, ${phaseId}, ${title.slice(0, 200)},
         ${String(body.user_story || "")}, ${String(body.acceptance_criteria || "")},
         ${businessValue}, ${effort}, ${bucket}, ${status}, ${sortOrder}, ${String(body.note || "")})
      RETURNING *
    `;
    const proj = await sql`SELECT name FROM projects WHERE id = ${projectId}`;
    await logActivity({
      userId: auth.id,
      projectId,
      projectName: proj[0]?.name,
      taskLabel: rows[0].title,
      action: "po_backlog_create",
    });
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
