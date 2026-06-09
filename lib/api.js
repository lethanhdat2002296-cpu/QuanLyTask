import { NextResponse } from "next/server";

// Ghi log chi tiết lỗi ra server, nhưng chỉ trả thông báo chung cho client
// (tránh lộ thông tin nội bộ: cấu trúc DB, lỗi driver...).
export function serverError(e, status = 500) {
  console.error(e);
  return NextResponse.json(
    { error: "Lỗi máy chủ, vui lòng thử lại sau." },
    { status }
  );
}
