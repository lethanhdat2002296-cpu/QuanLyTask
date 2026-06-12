"use client";

// Cache nhẹ phía trình duyệt cho danh sách dự án — nhiều trang cùng cần
// (bộ lọc, dropdown) và AppShell remount mỗi lần chuyển trang nên nếu không
// cache thì /api/projects bị gọi lại liên tục.
const TTL_MS = 30000;

let cached = null; // { at: epoch-ms, data: {projects, isAdmin} }
let inflight = null;

export async function fetchProjectsCached(force = false) {
  const now = Date.now();
  if (!force && cached && now - cached.at < TTL_MS) return cached.data;
  if (!inflight) {
    inflight = fetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        cached = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Gọi sau khi tạo/sửa/xóa dự án để các trang khác thấy dữ liệu mới ngay
export function invalidateProjectsCache() {
  cached = null;
}
