"use client";

// Khung xám nhấp nháy hiển thị trong lúc tải dữ liệu — đỡ "giật" hơn chữ "Đang tải...".
export default function Skeleton({ rows = 4, height = 52 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-row"
          style={{ height, opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}
