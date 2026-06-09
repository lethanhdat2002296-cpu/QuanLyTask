import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lấy chi tiết dự án (admin xem được mọi dự án)
export async function GET(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const rows = auth.isAdmin
      ? await sql`SELECT * FROM projects WHERE id = ${id}`
      : await sql`SELECT * FROM projects WHERE id = ${id} AND user_id = ${auth.id}`;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    return NextResponse.json({ project: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Cập nhật dự án (admin sửa được mọi dự án)
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên dự án" }, { status: 400 });
    }
    const rows = auth.isAdmin
      ? await sql`
          UPDATE projects SET name = ${name.trim()}, description = ${description || ""}
          WHERE id = ${id} RETURNING *
        `
      : await sql`
          UPDATE projects SET name = ${name.trim()}, description = ${description || ""}
          WHERE id = ${id} AND user_id = ${auth.id} RETURNING *
        `;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    return NextResponse.json({ project: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Xóa dự án (admin xóa được mọi dự án, kèm task bên trong)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const rows = auth.isAdmin
      ? await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`
      : await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${auth.id} RETURNING id`;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
