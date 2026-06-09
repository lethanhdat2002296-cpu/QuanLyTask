import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/auth";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    await ensureSchema();

    const inviteRequired = process.env.INVITE_CODE;
    if (!inviteRequired) {
      return NextResponse.json(
        { error: "Đăng ký đang tắt (chưa cấu hình INVITE_CODE)." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username = (body.username || "").trim();
    const password = body.password || "";
    const email = (body.email || "").trim().toLowerCase();
    const inviteCode = body.inviteCode || "";

    if (inviteCode !== inviteRequired) {
      return NextResponse.json({ error: "Mã mời không đúng" }, { status: 403 });
    }
    if (username.length < 3) {
      return NextResponse.json(
        { error: "Tên đăng nhập tối thiểu 3 ký tự" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu tối thiểu 6 ký tự" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Email không hợp lệ (cần để lấy lại mật khẩu)" },
        { status: 400 }
      );
    }

    // Pre-check thân thiện (thông báo chung để không lộ tài khoản nào tồn tại)
    const dup = await sql`
      SELECT 1 FROM users
      WHERE username = ${username} OR LOWER(email) = ${email}
      LIMIT 1
    `;
    if (dup[0]) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc email đã được sử dụng" },
        { status: 409 }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    let user;
    try {
      const rows = await sql`
        INSERT INTO users (username, password_hash, email)
        VALUES (${username}, ${hash}, ${email})
        RETURNING id, username, token_version
      `;
      user = rows[0];
    } catch (e) {
      // Trùng do race condition -> ràng buộc UNIQUE ở DB chặn lại
      if (e.code === "23505" || /duplicate key|unique/i.test(e.message || "")) {
        return NextResponse.json(
          { error: "Tên đăng nhập hoặc email đã được sử dụng" },
          { status: 409 }
        );
      }
      throw e;
    }

    const token = await createToken({
      sub: String(user.id),
      username: user.username,
      tv: user.token_version ?? 0,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      { ok: true, user: { id: user.id, username: user.username } },
      { status: 201 }
    );
  } catch (e) {
    return serverError(e);
  }
}
