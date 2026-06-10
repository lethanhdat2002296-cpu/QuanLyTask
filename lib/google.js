import { GoogleAuth } from "google-auth-library";
import { sheets as makeSheets } from "@googleapis/sheets";
import { PRIORITY_LABELS } from "@/lib/constants";

const HEADER = [
  "id", "Dự án", "Task khách hàng", "Đặt câu hỏi", "Khách trả lời", "Giải pháp",
  "Trạng thái", "Ưu tiên", "Ngày kết thúc", "Ngày hoàn thành", "Link",
];

// Đã cấu hình Google Sheets chưa?
export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT && process.env.GOOGLE_SHEET_ID
  );
}

let _client = null;
function getSheets() {
  if (_client) return _client;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _client = makeSheets({ version: "v4", auth });
  return _client;
}

// completed_at có thể là Date object (từ Neon) hoặc chuỗi ISO -> "YYYY-MM-DD HH:MM" giờ VN
function fmtCompleted(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 16);
}

function rowFor(task, projectName) {
  return [
    String(task.id),
    projectName || "",
    task.customer_task || "",
    task.question || "",
    task.customer_answer || "",
    task.solution || "",
    task.status || "",
    PRIORITY_LABELS[task.priority] || "",
    task.end_date ? String(task.end_date).slice(0, 10) : "",
    fmtCompleted(task.completed_at),
    task.doc_link || "",
  ];
}

// Tìm số dòng (1-based) chứa task id trong cột A; -1 nếu không có.
async function findRow(sheets, spreadsheetId, id) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A:A",
  });
  const vals = res.data.values || [];
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// Đẩy 1 task vào Sheet (thêm mới hoặc cập nhật theo id). BEST-EFFORT: không throw.
export async function syncTaskToSheet(task, projectName) {
  if (!isGoogleConfigured() || !task) return;
  try {
    const sheets = getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Đảm bảo có dòng tiêu đề
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A1:K1",
    });
    if (!head.data.values || head.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:K1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADER] },
      });
    }

    const row = rowFor(task, projectName);
    const at = await findRow(sheets, spreadsheetId, task.id);
    if (at > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `A${at}:K${at}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "A:K",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }
  } catch (e) {
    console.error("syncTaskToSheet lỗi (bỏ qua):", e.message);
  }
}

// Xóa dòng task khỏi Sheet (làm trống ô). BEST-EFFORT.
export async function deleteTaskFromSheet(id) {
  if (!isGoogleConfigured()) return;
  try {
    const sheets = getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const at = await findRow(sheets, spreadsheetId, id);
    if (at > 0) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `A${at}:K${at}`,
      });
    }
  } catch (e) {
    console.error("deleteTaskFromSheet lỗi (bỏ qua):", e.message);
  }
}
