import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: auth.id, username: auth.username, isAdmin: auth.isAdmin },
  });
}
