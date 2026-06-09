import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Xóa người dùng (chỉ admin; không cho tự xóa chính mình)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }
    const id = Number(params.id);
    if (id === auth.id) {
      return NextResponse.json(
        { error: "Không thể tự xóa tài khoản của chính mình" },
        { status: 400 }
      );
    }
    const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
