// Các trạng thái của một task. Bạn có thể chỉnh sửa danh sách này tùy ý.
export const TASK_STATUSES = [
  "Mới",
  "Đang xử lý",
  "Chờ khách phản hồi",
  "Đã có giải pháp",
  "Hoàn thành",
];

export const DEFAULT_STATUS = "Mới";

// Màu hiển thị badge cho từng trạng thái
export const STATUS_COLORS = {
  "Mới": "#6b7280",
  "Đang xử lý": "#2563eb",
  "Chờ khách phản hồi": "#d97706",
  "Đã có giải pháp": "#7c3aed",
  "Hoàn thành": "#16a34a",
};

// Mức độ ưu tiên (lưu dạng số để dễ sắp xếp: 1 = cao nhất).
// Màu CHỌN KHÁC tông với STATUS_COLORS để không nhầm ưu tiên với trạng thái:
//   Cao = đỏ, Trung bình = xanh ngọc (teal), Thấp = xám đậm. Chip ưu tiên có cờ ⚑.
export const PRIORITIES = [
  { value: 1, label: "Cao", color: "#dc2626" },
  { value: 2, label: "Trung bình", color: "#0d9488" },
  { value: 3, label: "Thấp", color: "#475569" },
];

export const DEFAULT_PRIORITY = 2;

export const PRIORITY_LABELS = { 1: "Cao", 2: "Trung bình", 3: "Thấp" };
export const PRIORITY_COLORS = { 1: "#dc2626", 2: "#0d9488", 3: "#475569" };

// Các trạng thái coi là "chưa xong" (dùng cho backlog/tồn đọng)
export const OPEN_STATUSES = TASK_STATUSES.filter((s) => s !== "Hoàn thành");

// ===== Chế độ PO =====

// Trạng thái giai đoạn phát triển
export const PHASE_STATUSES = ["Chưa bắt đầu", "Đang làm", "Hoàn thành"];
export const PHASE_STATUS_COLORS = {
  "Chưa bắt đầu": "#6b7280",
  "Đang làm": "#2563eb",
  "Hoàn thành": "#16a34a",
};
export const DEFAULT_PHASE_STATUS = "Chưa bắt đầu";

// Nhóm ưu tiên backlog kiểu PO: Now / Next / Later
export const BACKLOG_BUCKETS = [
  { value: "now", label: "Làm ngay (Now)", color: "#dc2626" },
  { value: "next", label: "Sắp tới (Next)", color: "#d97706" },
  { value: "later", label: "Để sau (Later)", color: "#475569" },
];
export const DEFAULT_BUCKET = "next";
export const BUCKET_LABELS = Object.fromEntries(
  BACKLOG_BUCKETS.map((b) => [b.value, b.label])
);
export const BUCKET_COLORS = Object.fromEntries(
  BACKLOG_BUCKETS.map((b) => [b.value, b.color])
);

// Trạng thái hạng mục backlog
export const BACKLOG_STATUSES = ["Ý tưởng", "Đã duyệt", "Đang làm", "Hoàn thành"];
export const BACKLOG_STATUS_COLORS = {
  "Ý tưởng": "#6b7280",
  "Đã duyệt": "#7c3aed",
  "Đang làm": "#2563eb",
  "Hoàn thành": "#16a34a",
};
export const DEFAULT_BACKLOG_STATUS = "Ý tưởng";

// Giá trị kinh doanh (1=Cao..3=Thấp — cùng thang với priority, tái dùng màu)
export const VALUE_LABELS = { 1: "Cao", 2: "Trung bình", 3: "Thấp" };
// Công sức ước lượng (1=Nhỏ..3=Lớn)
export const EFFORT_LABELS = { 1: "Nhỏ", 2: "Vừa", 3: "Lớn" };
