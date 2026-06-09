import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    await ensureSchema();
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu" },
        { status: 400 }
      );
    }
    const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { error: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }
    const token = await createToken({
      sub: String(user.id),
      username: user.username,
    });
    await setSessionCookie(token);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Lỗi máy chủ: " + e.message },
      { status: 500 }
    );
  }
}
