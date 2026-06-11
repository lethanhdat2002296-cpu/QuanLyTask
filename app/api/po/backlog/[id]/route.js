import { NextResponse } from "next/server";
import { sql, ensureSchema, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { BACKLOG_BUCKETS, BACKLOG_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_VALUES = BACKLOG_BUCKETS.map((b) => b.value);

// Lấy hạng mục nếu user có quyền (admin: mọi hạng mục; thường: qua dự án sở hữu)
async function getItemAuthorized(id, auth) {
  const rows = auth.isAdmin
    ? await sql`SELECT * FROM backlog_items WHERE id = ${id}`
    : await sql`
        SELECT b.* FROM backlog_items b
        JOIN projects p ON p.id = b.project_id
        WHERE b.id = ${id} AND p.user_id = ${auth.id}
      `;
  return rows[0] || null;
}

// Cập nhật toàn bộ hạng mục (không cho đổi dự án).
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const item = await getItemAuthorized(id, auth);
    if (!item) {
      return NextResponse.json(
        { error: "Không tìm thấy hạng mục" },
        { status: 404 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? item.title).trim();
    if (!title) {
      return NextResponse.json(
        { error: "Vui lòng nhập tiêu đề hạng mục" },
        { status: 400 }
      );
    }
    const userStory =
      body.user_story === undefined ? item.user_story : String(body.user_story || "");
    const acceptanceCriteria =
      body.acceptance_criteria === undefined
        ? item.acceptance_criteria
        : String(body.acceptance_criteria || "");
    const note = body.note === undefined ? item.note : String(body.note || "");
    const businessValue = [1, 2, 3].includes(Number(body.business_value))
      ? Number(body.business_value)
      : item.business_value;
    const effort = [1, 2, 3].includes(Number(body.effort))
      ? Number(body.effort)
      : item.effort;
    const bucket = BUCKET_VALUES.includes(body.bucket) ? body.bucket : item.bucket;
    const status = BACKLOG_STATUSES.includes(body.status)
      ? body.status
      : item.status;

    // Giai đoạn (nếu đổi) phải thuộc đúng dự án của hạng mục
    let phaseId =
      body.phase_id === undefined ? item.phase_id : Number(body.phase_id) || null;
    if (phaseId && phaseId !== item.phase_id) {
      const ok = await sql`
        SELECT 1 FROM phases WHERE id = ${phaseId} AND project_id = ${item.project_id}
      `;
      if (!ok.length) {
        return NextResponse.json(
          { error: "Giai đoạn không thuộc dự án này" },
          { status: 400 }
        );
      }
    }

    const rows = await sql`
      UPDATE backlog_items
      SET title = ${title.slice(0, 200)}, user_story = ${userStory},
          acceptance_criteria = ${acceptanceCriteria}, note = ${note},
          business_value = ${businessValue}, effort = ${effort},
          bucket = ${bucket}, status = ${status}, phase_id = ${phaseId},
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (
      item.title !== title ||
      item.status !== status ||
      item.bucket !== bucket ||
      Number(item.phase_id || 0) !== Number(phaseId || 0)
    ) {
      const proj = await sql`SELECT name FROM projects WHERE id = ${item.project_id}`;
      await logActivity({
        userId: auth.id,
        projectId: item.project_id,
        projectName: proj[0]?.name,
        taskLabel: title,
        action: "po_backlog_update",
      });
    }
    return NextResponse.json({ item: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Đổi nhanh bucket hoặc trạng thái. Body: { bucket? } hoặc { status? }
export async function PATCH(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const item = await getItemAuthorized(id, auth);
    if (!item) {
      return NextResponse.json(
        { error: "Không tìm thấy hạng mục" },
        { status: 404 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const bucket = BUCKET_VALUES.includes(body.bucket) ? body.bucket : item.bucket;
    const status = BACKLOG_STATUSES.includes(body.status)
      ? body.status
      : item.status;
    let sortOrder = item.sort_order;
    if (bucket !== item.bucket) {
      const orderRows = await sql`
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
        FROM backlog_items
        WHERE project_id = ${item.project_id} AND bucket = ${bucket}
      `;
      sortOrder = Number(orderRows[0]?.next_order || 0);
    }
    const rows = await sql`
      UPDATE backlog_items
      SET bucket = ${bucket}, status = ${status}, sort_order = ${sortOrder}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (bucket !== item.bucket || status !== item.status) {
      const proj = await sql`SELECT name FROM projects WHERE id = ${item.project_id}`;
      await logActivity({
        userId: auth.id,
        projectId: item.project_id,
        projectName: proj[0]?.name,
        taskLabel: item.title,
        action: bucket !== item.bucket ? "po_backlog_bucket_change" : "po_backlog_status_change",
        field: bucket !== item.bucket ? "bucket" : "status",
        oldValue: bucket !== item.bucket ? item.bucket : item.status,
        newValue: bucket !== item.bucket ? bucket : status,
      });
    }
    return NextResponse.json({ item: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Xóa hạng mục
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const item = await getItemAuthorized(id, auth);
    if (!item) {
      return NextResponse.json(
        { error: "Không tìm thấy hạng mục" },
        { status: 404 }
      );
    }
    const proj = await sql`SELECT name FROM projects WHERE id = ${item.project_id}`;
    await logActivity({
      userId: auth.id,
      projectId: item.project_id,
      projectName: proj[0]?.name,
      taskLabel: item.title,
      action: "po_backlog_delete",
    });
    await sql`DELETE FROM backlog_items WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
