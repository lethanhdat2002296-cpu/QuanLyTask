import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    await ensureSchema();
    const { token, password } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Thiếu mã đặt lại" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới tối thiểu 6 ký tự" },
        { status: 400 }
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Claim token nguyên tử: chỉ 1 request "chiếm" được token hợp lệ chưa dùng & chưa hết hạn
    const claimed = await sql`
      UPDATE password_reset_tokens
      SET used = true
      WHERE token_hash = ${tokenHash} AND used = false AND expires_at > now()
      RETURNING user_id
    `;
    const row = claimed[0];
    if (!row) {
      return NextResponse.json(
        { error: "Link đặt lại không hợp lệ hoặc đã hết hạn. Hãy yêu cầu link mới." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    // Đổi mật khẩu + tăng token_version -> mọi phiên/đăng nhập cũ bị vô hiệu
    await sql`
      UPDATE users
      SET password_hash = ${hash}, token_version = token_version + 1
      WHERE id = ${row.user_id}
    `;
    // Dọn toàn bộ token còn lại của user
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${row.user_id}`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
