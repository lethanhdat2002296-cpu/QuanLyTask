import { NextResponse } from "next/server";
import { sql, ensureSchema, canAccessProject } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { BACKLOG_BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_VALUES = BACKLOG_BUCKETS.map((b) => b.value);

export async function POST(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = Number(body.project_id);
    const bucket = body.bucket;
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map(Number).filter(Boolean)
      : [];

    if (!projectId || !BUCKET_VALUES.includes(bucket) || orderedIds.length === 0) {
      return NextResponse.json({ error: "Thiếu dữ liệu sắp xếp." }, { status: 400 });
    }
    if (!(await canAccessProject(projectId, auth))) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const rows = await sql`
      SELECT id FROM backlog_items
      WHERE project_id = ${projectId} AND bucket = ${bucket}
    `;
    const valid = new Set(rows.map((r) => Number(r.id)));
    if (orderedIds.some((id) => !valid.has(id))) {
      return NextResponse.json(
        { error: "Danh sách sắp xếp có hạng mục không thuộc dự án/nhóm này." },
        { status: 400 }
      );
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await sql`
        UPDATE backlog_items SET sort_order = ${i}, updated_at = now()
        WHERE id = ${orderedIds[i]} AND project_id = ${projectId} AND bucket = ${bucket}
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
