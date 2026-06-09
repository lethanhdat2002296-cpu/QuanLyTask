import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";

const COOKIE_NAME = "qlt_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Thiếu biến môi trường JWT_SECRET.");
  }
  return new TextEncoder().encode(secret);
}

// Tạo token JWT cho user đã đăng nhập
export async function createToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

// Kiểm tra token, trả về payload nếu hợp lệ, null nếu sai/hết hạn
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

// Đặt cookie phiên đăng nhập (gọi trong route handler)
export async function setSessionCookie(token) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

// Xóa cookie phiên (đăng xuất)
export async function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// Lấy thông tin user hiện tại từ cookie (dùng trong server component / route handler).
// Có kiểm tra token_version trong DB: token cũ sẽ bị từ chối sau khi đổi mật khẩu.
export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = await verifyToken(token);
  if (!payload) return null;

  await ensureSchema();
  const rows = await sql`
    SELECT token_version FROM users WHERE id = ${Number(payload.sub)}
  `;
  if (!rows[0]) return null; // user đã bị xóa
  if (Number(rows[0].token_version) !== Number(payload.tv ?? 0)) {
    return null; // token đã bị thu hồi (đổi mật khẩu)
  }
  return payload;
}

// Lấy ID người dùng hiện tại (số), hoặc null nếu chưa đăng nhập
export async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user) return null;
  const id = Number(user.sub);
  return Number.isFinite(id) ? id : null;
}

export { COOKIE_NAME };
