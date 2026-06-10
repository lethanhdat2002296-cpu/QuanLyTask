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
