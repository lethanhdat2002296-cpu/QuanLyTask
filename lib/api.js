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

// Chỉ chấp nhận ngày THẬT dạng YYYY-MM-DD (loại 2026-13-40...), còn lại trả null
export function normalizeDate(s) {
  const v = (s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  // chặn ngày bị JS tự cuộn (vd 2026-02-30 -> 03-02)
  return d.toISOString().slice(0, 10) === v ? v : null;
}
