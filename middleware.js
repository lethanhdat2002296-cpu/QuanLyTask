import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "qlt_session";

// Các đường dẫn không cần đăng nhập
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Thiếu JWT_SECRET");
  return new TextEncoder().encode(secret);
}

async function isValid(token) {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await isValid(token);

  if (ok) return NextResponse.next();

  // Chưa đăng nhập: API trả 401, trang web chuyển về /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// Chạy middleware cho mọi route trừ file tĩnh của Next.js
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
