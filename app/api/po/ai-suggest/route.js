import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { isGeminiConfigured, suggestBacklogItem } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nhờ AI (Gemini, vai Product Owner) viết user story + tiêu chí chấp nhận +
// chấm giá trị kinh doanh cho 1 hạng mục backlog. Body: { project_id, title, note }.
export async function POST(request) {
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

    const body = await request.json().catch(() => ({}));
    const projectId = Number(body.project_id);
    if (!projectId) {
      return NextResponse.json({ error: "Thiếu dự án" }, { status: 400 });
    }
    // Lấy dự án theo quyền (admin xem mọi dự án; người thường cần sở hữu)
    const rows = auth.isAdmin
      ? await sql`SELECT id, reference_docs FROM projects WHERE id = ${projectId}`
      : await sql`SELECT id, reference_docs FROM projects WHERE id = ${projectId} AND user_id = ${auth.id}`;
    const project = rows[0];
    if (!project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const title = String(body.title || "").slice(0, 500);
    const note = String(body.note || "").slice(0, 8000);
    if (!title.trim() && !note.trim()) {
      return NextResponse.json(
        { error: "Hãy nhập tiêu đề hạng mục trước khi nhờ AI gợi ý." },
        { status: 400 }
      );
    }

    let data;
    try {
      data = await suggestBacklogItem({
        referenceDocs: project.reference_docs || "",
        title,
        note,
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
      console.error("Gemini suggestBacklogItem lỗi:", msg);
      return NextResponse.json(
        { error: "Không gọi được AI lúc này, thử lại sau." },
        { status: 502 }
      );
    }

    // Chuẩn hoá đầu ra: business_value phải ∈ {1,2,3}
    let businessValue = Number(data?.businessValue);
    if (![1, 2, 3].includes(businessValue)) businessValue = 2;

    return NextResponse.json({
      user_story: String(data?.userStory || ""),
      acceptance_criteria: String(data?.acceptanceCriteria || ""),
      business_value: businessValue,
      valueReason: String(data?.valueReason || ""),
    });
  } catch (e) {
    return serverError(e);
  }
}
