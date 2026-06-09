import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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

// Lấy thông tin user hiện tại từ cookie (dùng trong server component / route handler)
export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return await verifyToken(token);
}

export { COOKIE_NAME };
