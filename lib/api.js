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

// Chuẩn hóa link tài liệu: ép về http(s) để bấm mở an toàn (chặn javascript:/data:)
export function normalizeLink(s) {
  const v = (s || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return "https://" + v;
}

// Chỉ chấp nhận ngày dạng YYYY-MM-DD, còn lại trả null
export function normalizeDate(s) {
  const v = (s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
