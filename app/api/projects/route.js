import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách dự án: admin thấy TẤT CẢ (kèm chủ sở hữu), người thường chỉ thấy của mình
export async function GET() {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const rows = auth.isAdmin
      ? await sql`
          SELECT
            p.id, p.name, p.description, p.created_at,
            u.username AS owner_username,
            COUNT(t.id)::int AS task_count,
            COUNT(t.id) FILTER (WHERE t.status = 'Hoàn thành')::int AS done_count
          FROM projects p
          LEFT JOIN tasks t ON t.project_id = p.id
          LEFT JOIN users u ON u.id = p.user_id
          GROUP BY p.id, u.username
          ORDER BY p.created_at DESC
        `
      : await sql`
          SELECT
            p.id, p.name, p.description, p.created_at,
            COUNT(t.id)::int AS task_count,
            COUNT(t.id) FILTER (WHERE t.status = 'Hoàn thành')::int AS done_count
          FROM projects p
          LEFT JOIN tasks t ON t.project_id = p.id
          WHERE p.user_id = ${auth.id}
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `;
    return NextResponse.json({ projects: rows, isAdmin: auth.isAdmin });
  } catch (e) {
    return serverError(e);
  }
}

// Tạo dự án mới gắn với người dùng hiện tại
export async function POST(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const { name, description } = await request.json().catch(() => ({}));
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên dự án" },
        { status: 400 }
      );
    }
    const rows = await sql`
      INSERT INTO projects (name, description, user_id)
      VALUES (${name.trim()}, ${description || ""}, ${auth.id})
      RETURNING *
    `;
    return NextResponse.json({ project: rows[0] }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
