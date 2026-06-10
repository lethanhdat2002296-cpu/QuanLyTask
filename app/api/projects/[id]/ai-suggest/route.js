import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { isGeminiConfigured, suggestTask } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nhờ AI (Gemini) gợi ý độ ưu tiên + giải pháp cho 1 task,
// dựa trên tài liệu tham khảo của dự án. Body: { title, customer_task }.
export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error:
            "Tính năng AI chưa được cấu hình (thiếu GEMINI_API_KEY). Xem README.",
        },
        { status: 503 }
      );
    }

    const id = Number(params.id);
    // Lấy dự án theo quyền (admin xem mọi dự án; người thường cần sở hữu)
    const rows = auth.isAdmin
      ? await sql`SELECT id, name, reference_docs FROM projects WHERE id = ${id}`
      : await sql`SELECT id, name, reference_docs FROM projects WHERE id = ${id} AND user_id = ${auth.id}`;
    const project = rows[0];
    if (!project) {
      return NextResponse.json(
        { error: "Không tìm thấy dự án" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").slice(0, 500);
    const customerTask = String(body.customer_task || "").slice(0, 8000);
    if (!title.trim() && !customerTask.trim()) {
      return NextResponse.json(
        { error: "Hãy nhập tiêu đề hoặc nội dung task trước khi nhờ AI gợi ý." },
        { status: 400 }
      );
    }

    let data;
    try {
      data = await suggestTask({
        referenceDocs: project.reference_docs || "",
        title,
        customerTask,
      });
    } catch (e) {
      const msg = String(e?.message || "");
      const status = e?.status || e?.code;
      // Hết lượt / quá tần suất của bậc miễn phí Gemini
      if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED|429/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "AI đang bận hoặc đã hết lượt miễn phí hôm nay, thử lại sau ít phút.",
          },
          { status: 429 }
        );
      }
      console.error("Gemini suggestTask lỗi:", msg);
      return NextResponse.json(
        { error: "Không gọi được AI lúc này, thử lại sau." },
        { status: 502 }
      );
    }

    // Chuẩn hoá đầu ra: priority phải ∈ {1,2,3}
    let priority = Number(data?.priority);
    if (![1, 2, 3].includes(priority)) priority = 2;

    return NextResponse.json({
      priority,
      priorityReason: String(data?.priorityReason || ""),
      solution: String(data?.solution || ""),
      questions: String(data?.questions || ""),
    });
  } catch (e) {
    return serverError(e);
  }
}
