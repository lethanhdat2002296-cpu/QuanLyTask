import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sql, ensureSchema } from "@/lib/db";
import { sendResetEmail, isEmailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MSG =
  "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục Spam).";

export async function POST(request) {
  try {
    await ensureSchema();

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Tính năng email chưa được cấu hình. Quản trị viên cần thêm SMTP_HOST/SMTP_USER/SMTP_PASS.",
        },
        { status: 503 }
      );
    }

    const { email } = await request.json();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (cleanEmail) {
      const rows = await sql`SELECT id FROM users WHERE LOWER(email) = ${cleanEmail}`;
      const user = rows[0];
      if (user) {
        // Chống gửi dồn: nếu vừa tạo token trong 2 phút gần đây thì bỏ qua (vẫn trả thông báo chung)
        const recent = await sql`
          SELECT 1 FROM password_reset_tokens
          WHERE user_id = ${user.id} AND created_at > now() - interval '2 minutes'
          LIMIT 1
        `;
        if (!recent[0]) {
          const token = crypto.randomBytes(32).toString("base64url");
          const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

          await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
          await sql`
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES (${user.id}, ${tokenHash}, now() + interval '1 hour')
          `;

          // URL gốc: ưu tiên APP_URL (an toàn), chỉ fallback header khi chạy local chưa set
          const proto = request.headers.get("x-forwarded-proto") || "https";
          const host = request.headers.get("host");
          const base = process.env.APP_URL || `${proto}://${host}`;
          const resetUrl = `${base}/reset-password?token=${token}`;

          await sendResetEmail(cleanEmail, resetUrl);
        }
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC_MSG });
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json(
      { error: "Không gửi được email. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
