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
    // Bắt buộc danh sách ĐẦY ĐỦ + đúng nhóm (thiếu phần tử sẽ làm thứ tự lai tạp)
    if (
      orderedIds.length !== rows.length ||
      orderedIds.some((id) => !valid.has(id))
    ) {
      return NextResponse.json(
        { error: "Danh sách sắp xếp không khớp các hạng mục trong nhóm này." },
        { status: 400 }
      );
    }

    // 1 lệnh UPDATE duy nhất (nguyên tử, 1 roundtrip DB) thay cho N lệnh trong vòng lặp
    await sql`
      UPDATE backlog_items b
      SET sort_order = x.ord - 1, updated_at = now()
      FROM (
        SELECT unnest(${orderedIds}::int[]) AS id,
               generate_subscripts(${orderedIds}::int[], 1) AS ord
      ) x
      WHERE b.id = x.id AND b.project_id = ${projectId} AND b.bucket = ${bucket}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
