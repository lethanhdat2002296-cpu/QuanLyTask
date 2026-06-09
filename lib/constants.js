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
