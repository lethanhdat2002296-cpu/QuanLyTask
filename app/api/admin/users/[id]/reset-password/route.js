import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin đặt lại mật khẩu cho một người dùng (thu hồi phiên cũ của họ)
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
    const { password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới tối thiểu 6 ký tự" },
        { status: 400 }
      );
    }
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      UPDATE users
      SET password_hash = ${hash}, token_version = token_version + 1
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
