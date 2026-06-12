import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, escapeLike } from "@/lib/api";
import { TASK_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Danh sách task xuyên TẤT CẢ dự án của người dùng (admin xem tất cả) — dùng cho "Công việc của tôi".
// Bộ lọc: ?status=&project=&overdue=1&done=0|1   Sắp xếp: ?sort=end_date|priority|created_at
export async function GET(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const sp = new URL(request.url).searchParams;
    const statusRaw = sp.get("status");
    const status = TASK_STATUSES.includes(statusRaw) ? statusRaw : null;
    const projectId = Number(sp.get("project")) || null;
    const doneRaw = sp.get("done");
    const doneMode = doneRaw === "0" ? "open" : doneRaw === "1" ? "done" : null;
    const overdueOnly = sp.get("overdue") === "1";
    const sort = sp.get("sort") || "default";
    const qRaw = (sp.get("q") || "").trim();
    const like = qRaw ? "%" + escapeLike(qRaw) + "%" : null;

    const rows = await sql`
      SELECT
        t.id, t.project_id, p.name AS project_name,
        t.title, t.customer_task, t.question, t.customer_answer, t.solution,
        t.status, t.priority, t.doc_link,
        t.end_date::text AS end_date, t.completed_at, t.created_at, t.updated_at,
        (t.end_date IS NOT NULL
         AND t.end_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         AND t.status <> 'Hoàn thành') AS is_overdue,
        (t.end_date IS NOT NULL
         AND t.end_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         AND t.end_date <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 3
         AND t.status <> 'Hoàn thành') AS is_due_soon
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE (${auth.isAdmin} OR p.user_id = ${auth.id})
        AND (${status}::text IS NULL OR t.status = ${status})
        AND (${projectId}::int IS NULL OR t.project_id = ${projectId})
        AND (${doneMode}::text IS NULL
             OR (${doneMode} = 'open' AND t.status <> 'Hoàn thành')
             OR (${doneMode} = 'done' AND t.status = 'Hoàn thành'))
        AND (${overdueOnly}::boolean IS NOT TRUE
             OR (t.end_date IS NOT NULL
                 AND t.end_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                 AND t.status <> 'Hoàn thành'))
        AND (${like}::text IS NULL OR (
             t.title ILIKE ${like} OR t.customer_task ILIKE ${like}
             OR t.question ILIKE ${like} OR t.customer_answer ILIKE ${like}
             OR t.solution ILIKE ${like}
        ))
      ORDER BY is_overdue DESC, t.end_date ASC NULLS LAST, t.priority ASC, t.created_at DESC
    `;

    // Sắp xếp lại theo yêu cầu (dữ liệu cá nhân nhỏ nên sắp ở JS cho linh hoạt)
    const tasks = [...rows];
    if (sort === "priority") {
      tasks.sort((a, b) => a.priority - b.priority);
    } else if (sort === "created_at") {
      tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === "end_date") {
      tasks.sort((a, b) => {
        if (!a.end_date && !b.end_date) return 0;
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return a.end_date < b.end_date ? -1 : a.end_date > b.end_date ? 1 : 0;
      });
    }

    return NextResponse.json({ tasks, isAdmin: auth.isAdmin });
  } catch (e) {
    return serverError(e);
  }
}
