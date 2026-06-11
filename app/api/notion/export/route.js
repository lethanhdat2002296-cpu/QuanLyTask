import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { serverError } from "@/lib/api";
import { createNotionExportPage, isNotionConfigured } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sectionsFromTask(row) {
  return [
    { title: "Dự án", body: row.project_name },
    { title: "Trạng thái", body: row.status },
    { title: "Ưu tiên", body: String(row.priority || "") },
    { title: "Nội dung khách hàng", body: row.customer_task },
    { title: "Câu hỏi", body: row.question },
    { title: "Khách trả lời", body: row.customer_answer },
    { title: "Giải pháp", body: row.solution },
    { title: "Hạn", body: row.end_date || "" },
    { title: "Link tài liệu", body: row.doc_link || "" },
  ];
}

function sectionsFromBacklog(row) {
  return [
    { title: "Dự án", body: row.project_name },
    { title: "Giai đoạn", body: row.phase_name || "" },
    { title: "Nhóm ưu tiên", body: row.bucket },
    { title: "Trạng thái", body: row.status },
    { title: "Giá trị kinh doanh", body: String(row.business_value || "") },
    { title: "Công sức", body: String(row.effort || "") },
    { title: "User story", body: row.user_story },
    { title: "Tiêu chí chấp nhận", body: row.acceptance_criteria },
    { title: "Ghi chú", body: row.note },
  ];
}

export async function POST(request) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Chưa cấu hình NOTION_TOKEN / NOTION_DATABASE_ID." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type;
    const id = Number(body.id);
    if (!id || !["task", "backlog"].includes(type)) {
      return NextResponse.json({ error: "Thiếu loại dữ liệu hoặc ID." }, { status: 400 });
    }

    let title = "";
    let sections = [];
    if (type === "task") {
      const rows = await sql`
        SELECT t.*, t.end_date::text AS end_date, p.name AS project_name, p.user_id
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.id = ${id} AND (${auth.isAdmin} OR p.user_id = ${auth.id})
      `;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
      title = `[Task] ${row.title || row.customer_task || "Không tiêu đề"}`;
      sections = sectionsFromTask(row);
    } else {
      const rows = await sql`
        SELECT b.*, p.name AS project_name, p.user_id, ph.name AS phase_name
        FROM backlog_items b
        JOIN projects p ON p.id = b.project_id
        LEFT JOIN phases ph ON ph.id = b.phase_id
        WHERE b.id = ${id} AND (${auth.isAdmin} OR p.user_id = ${auth.id})
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "Không tìm thấy hạng mục backlog" }, { status: 404 });
      }
      title = `[Backlog] ${row.title}`;
      sections = sectionsFromBacklog(row);
    }

    const page = await createNotionExportPage({ title, sections });
    return NextResponse.json({ ok: true, pageId: page.id, url: page.url });
  } catch (e) {
    return serverError(e);
  }
}
