import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lấy chi tiết 1 dự án
export async function GET(_request, { params }) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Không tìm thấy dự án" },
        { status: 404 }
      );
    }
    return NextResponse.json({ project: rows[0] });
  } catch (e) {
    console.error("Get project error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Cập nhật dự án
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên dự án" },
        { status: 400 }
      );
    }
    const rows = await sql`
      UPDATE projects
      SET name = ${name.trim()}, description = ${description || ""}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Không tìm thấy dự án" },
        { status: 404 }
      );
    }
    return NextResponse.json({ project: rows[0] });
  } catch (e) {
    console.error("Update project error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Xóa dự án (kèm toàn bộ task bên trong)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    await sql`DELETE FROM projects WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete project error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
