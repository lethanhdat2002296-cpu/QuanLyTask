import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "Asia/Ho_Chi_Minh";

// Số liệu tổng quan cho trang chủ (theo người dùng; admin xem tất cả).
export async function GET() {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const admin = auth.isAdmin;
    const uid = auth.id;

    const byStatus = await sql`
      SELECT t.status,
             COUNT(*)::int AS count,
             COUNT(*) FILTER (
               WHERE t.end_date IS NOT NULL
                 AND t.end_date < (now() AT TIME ZONE ${TZ})::date
                 AND t.status <> 'Hoàn thành'
             )::int AS overdue
      FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE (${admin} OR p.user_id = ${uid})
      GROUP BY t.status
    `;

    const completed = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE (t.completed_at AT TIME ZONE ${TZ})::date
                >= date_trunc('week', (now() AT TIME ZONE ${TZ}))::date
        )::int AS week,
        COUNT(*) FILTER (
          WHERE (t.completed_at AT TIME ZONE ${TZ})::date
                >= date_trunc('month', (now() AT TIME ZONE ${TZ}))::date
        )::int AS month
      FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE (${admin} OR p.user_id = ${uid}) AND t.completed_at IS NOT NULL
    `;

    const byProject = await sql`
      SELECT p.name,
             COUNT(t.id)::int AS total,
             COUNT(t.id) FILTER (WHERE t.status = 'Hoàn thành')::int AS done,
             COUNT(t.id) FILTER (
               WHERE t.end_date IS NOT NULL
                 AND t.end_date < (now() AT TIME ZONE ${TZ})::date
                 AND t.status <> 'Hoàn thành'
             )::int AS overdue
      FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
      WHERE (${admin} OR p.user_id = ${uid})
      GROUP BY p.id, p.name
      ORDER BY total DESC
      LIMIT 8
    `;

    let total = 0,
      done = 0,
      overdue = 0;
    for (const r of byStatus) {
      total += r.count;
      overdue += r.overdue;
      if (r.status === "Hoàn thành") done += r.count;
    }

    return NextResponse.json({
      total,
      done,
      open: total - done,
      overdue,
      completedThisWeek: completed[0]?.week || 0,
      completedThisMonth: completed[0]?.month || 0,
      byStatus,
      byProject,
      isAdmin: admin,
    });
  } catch (e) {
    return serverError(e);
  }
}
