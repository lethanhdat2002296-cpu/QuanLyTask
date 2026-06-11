import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { isGeminiConfigured, suggestProductDirection } from "@/lib/gemini";
import { VALUE_LABELS, EFFORT_LABELS, BUCKET_LABELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI (vai cố vấn sản phẩm) đánh giá HƯỚNG PHÁT TRIỂN của 1 dự án.
// Body: { project_id }
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
    const projRows = auth.isAdmin
      ? await sql`SELECT id, name, reference_docs FROM projects WHERE id = ${projectId}`
      : await sql`SELECT id, name, reference_docs FROM projects WHERE id = ${projectId} AND user_id = ${auth.id}`;
    const project = projRows[0];
    if (!project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const phases = await sql`
      SELECT ph.name, ph.status,
             COUNT(b.id)::int AS item_count,
             (COUNT(b.id) FILTER (WHERE b.status = 'Hoàn thành'))::int AS done_count,
             (ph.end_date IS NOT NULL
              AND ph.end_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              AND ph.status <> 'Hoàn thành') AS is_overdue
      FROM phases ph
      LEFT JOIN backlog_items b ON b.phase_id = ph.id
      WHERE ph.project_id = ${projectId}
      GROUP BY ph.id
      ORDER BY ph.start_date ASC NULLS LAST, ph.created_at ASC
    `;
    const items = await sql`
      SELECT title, business_value, effort, bucket, status
      FROM backlog_items WHERE project_id = ${projectId}
    `;

    if (items.length === 0 && phases.length === 0) {
      return NextResponse.json(
        { error: "Dự án chưa có giai đoạn hay hạng mục nào để phân tích." },
        { status: 400 }
      );
    }

    // ----- Tính chỉ số -----
    const cntBucket = (arr, b) => arr.filter((i) => i.bucket === b).length;
    const notDone = items.filter((i) => i.status !== "Hoàn thành");
    const doneCount = items.length - notDone.length;
    const cntVal = (v) => items.filter((i) => Number(i.business_value) === v).length;
    const statusCounts = {};
    for (const i of items) statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;

    const productData = `CHỈ SỐ BACKLOG:
- Tổng hạng mục: ${items.length} (đã Hoàn thành: ${doneCount}, còn lại: ${notDone.length})
- Theo nhóm ưu tiên: Làm ngay ${cntBucket(items, "now")}, Sắp tới ${cntBucket(items, "next")}, Để sau ${cntBucket(items, "later")}
- Hạng mục CHƯA xong theo nhóm: Làm ngay ${cntBucket(notDone, "now")}, Sắp tới ${cntBucket(notDone, "next")}, Để sau ${cntBucket(notDone, "later")}
- Theo giá trị kinh doanh: Cao ${cntVal(1)}, Trung bình ${cntVal(2)}, Thấp ${cntVal(3)}
- Theo trạng thái: ${Object.entries(statusCounts).map(([s, n]) => `${s} ${n}`).join(", ") || "(trống)"}

GIAI ĐOẠN (${phases.length}):
${phases.map((ph) => `- ${ph.name} | ${ph.status}${ph.is_overdue ? " (TRỄ HẠN)" : ""} | hoàn thành ${ph.done_count}/${ph.item_count} hạng mục`).join("\n") || "(chưa có giai đoạn)"}

CÁC HẠNG MỤC CHƯA HOÀN THÀNH (tiêu đề | giá trị | công sức | nhóm):
${notDone.map((i) => `- ${i.title} | giá trị ${VALUE_LABELS[i.business_value] || "?"} | công sức ${EFFORT_LABELS[i.effort] || "?"} | ${BUCKET_LABELS[i.bucket] || i.bucket}`).join("\n") || "(không còn hạng mục nào chưa làm — backlog hiện tại đã hoàn thành hết)"}`;

    let data;
    try {
      data = await suggestProductDirection({
        referenceDocs: project.reference_docs || "",
        productData,
      });
    } catch (e) {
      const msg = String(e?.message || "");
      const status = e?.status || e?.code;
      if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED|429/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "AI đang bận hoặc đã hết lượt miễn phí hôm nay, thử lại sau ít phút.",
          },
          { status: 429 }
        );
      }
      console.error("Gemini suggestProductDirection lỗi:", msg);
      return NextResponse.json(
        { error: "Không gọi được AI lúc này, thử lại sau." },
        { status: 502 }
      );
    }

    return NextResponse.json({ analysis: data });
  } catch (e) {
    return serverError(e);
  }
}
