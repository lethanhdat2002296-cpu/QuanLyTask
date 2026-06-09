import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hash giả để so sánh khi user không tồn tại -> thời gian phản hồi gần như nhau,
// tránh dò tên đăng nhập qua timing.
const DUMMY_HASH = "$2a$10$Gh8EDUY123LWG/GAUgaEoOjV4WTlxQk4qBbGHk/BMIwlGgpmyykBm";

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

    const match = await bcrypt.compare(
      password,
      user ? user.password_hash : DUMMY_HASH
    );
    if (!user || !match) {
      return NextResponse.json(
        { error: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }

    const token = await createToken({
      sub: String(user.id),
      username: user.username,
      tv: user.token_version ?? 0,
    });
    await setSessionCookie(token);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
    });
  } catch (e) {
    return serverError(e);
  }
}
