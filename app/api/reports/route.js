import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeDate } from "@/lib/api";
import { PRIORITY_LABELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "Asia/Ho_Chi_Minh";

function csvCell(v) {
  let s = v == null ? "" : String(v);
  // Chống chèn công thức khi mở bằng Excel/Sheets (CSV injection)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// Xuất báo cáo task ra CSV.
// ?period=week|month|all|custom  &from=YYYY-MM-DD&to=YYYY-MM-DD
// week/month/custom: các task ĐÃ HOÀN THÀNH trong kỳ. all: tất cả task.
export async function GET(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const sp = new URL(request.url).searchParams;
    let period = sp.get("period") || "month";
    if (!["week", "month", "all", "custom"].includes(period)) period = "month";
    let from = normalizeDate(sp.get("from"));
    let to = normalizeDate(sp.get("to"));
    if (period === "custom" && (!from || !to)) period = "month";
    // đảo nếu nhập ngược (chuỗi YYYY-MM-DD so sánh từ điển = đúng thứ tự)
    if (period === "custom" && from > to) [from, to] = [to, from];

    const rows = await sql`
      SELECT p.name AS project_name, t.customer_task, t.question, t.customer_answer,
             t.solution, t.status, t.priority, t.end_date::text AS end_date,
             to_char(t.completed_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD HH24:MI') AS completed_local,
             t.doc_link
      FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE (${auth.isAdmin} OR p.user_id = ${auth.id})
        AND (
          ${period} = 'all'
          OR (t.completed_at IS NOT NULL AND (
            (${period} = 'week'  AND (t.completed_at AT TIME ZONE ${TZ})::date >= date_trunc('week',  (now() AT TIME ZONE ${TZ}))::date)
            OR (${period} = 'month' AND (t.completed_at AT TIME ZONE ${TZ})::date >= date_trunc('month', (now() AT TIME ZONE ${TZ}))::date)
            OR (${period} = 'custom' AND (t.completed_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date)
          ))
        )
      ORDER BY t.completed_at DESC NULLS LAST, t.created_at DESC
    `;

    const headers = [
      "Dự án", "Task khách hàng", "Đặt câu hỏi", "Khách trả lời", "Giải pháp",
      "Trạng thái", "Ưu tiên", "Ngày kết thúc", "Ngày hoàn thành", "Link tài liệu",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.project_name, r.customer_task, r.question, r.customer_answer, r.solution,
          r.status, PRIORITY_LABELS[r.priority] || r.priority, r.end_date || "",
          r.completed_local || "", r.doc_link,
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const BOM = String.fromCharCode(0xfeff); // giúp Excel đọc đúng tiếng Việt
    const csv = BOM + lines.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bao-cao-${period}.csv"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
