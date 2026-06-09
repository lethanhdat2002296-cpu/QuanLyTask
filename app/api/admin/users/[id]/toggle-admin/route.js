import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cấp / thu hồi quyền admin (chỉ admin; không cho tự đổi quyền của chính mình)
export async function POST(request, { params }) {
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
        { error: "Không thể tự đổi quyền của chính mình (tránh tự khóa)" },
        { status: 400 }
      );
    }
    const { isAdmin } = await request.json();
    const rows = await sql`
      UPDATE users SET is_admin = ${isAdmin === true} WHERE id = ${id}
      RETURNING id, username, is_admin
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}
