import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách dự án kèm số lượng task
export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at,
        COUNT(t.id)::int AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'Hoàn thành')::int AS done_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    return NextResponse.json({ projects: rows });
  } catch (e) {
    console.error("List projects error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Tạo dự án mới
export async function POST(request) {
  try {
    await ensureSchema();
    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên dự án" },
        { status: 400 }
      );
    }
    const rows = await sql`
      INSERT INTO projects (name, description)
      VALUES (${name.trim()}, ${description || ""})
      RETURNING *
    `;
    return NextResponse.json({ project: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("Create project error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
