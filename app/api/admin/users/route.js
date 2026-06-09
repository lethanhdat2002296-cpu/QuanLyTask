import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách tất cả người dùng (chỉ admin)
export async function GET() {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }
    const rows = await sql`
      SELECT
        u.id, u.username, u.email, u.is_admin, u.created_at,
        COUNT(p.id)::int AS project_count
      FROM users u
      LEFT JOIN projects p ON p.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at
    `;
    return NextResponse.json({ users: rows, currentUserId: auth.id });
  } catch (e) {
    return serverError(e);
  }
}
