import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dòng thời gian hoạt động của người dùng (admin xem tất cả).
// Lọc: ?from=YYYY-MM-DD&to=YYYY-MM-DD&project=<id>
export async function GET(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") || null;
    const to = sp.get("to") || null;
    const projectId = Number(sp.get("project")) || null;

    const rows = await sql`
      SELECT id, task_id, project_id, project_name, task_label,
             action, field, old_value, new_value, created_at
      FROM task_activity_log
      WHERE (${auth.isAdmin} OR user_id = ${auth.id})
        AND (${from}::text IS NULL
             OR (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from}::date)
        AND (${to}::text IS NULL
             OR (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to}::date)
        AND (${projectId}::int IS NULL OR project_id = ${projectId})
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return NextResponse.json({ activity: rows });
  } catch (e) {
    return serverError(e);
  }
}
