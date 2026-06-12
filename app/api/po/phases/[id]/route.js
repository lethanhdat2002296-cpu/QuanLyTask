import { NextResponse } from "next/server";
import { sql, ensureSchema, logActivity } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { serverError, normalizeDate, isInvalidDateInput } from "@/lib/api";
import { PHASE_STATUSES } from "@/lib/constants";

// Chuẩn hóa DATE (Neon trả Date object NỬA ĐÊM GIỜ ĐỊA PHƯƠNG) / chuỗi về "YYYY-MM-DD".
// Phải dùng getFullYear/getMonth/getDate (giờ địa phương) — toISOString sẽ lệch -1 ngày
// trên máy múi giờ VN (đã dính khi smoke test).
function toYMD(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lấy giai đoạn nếu user có quyền (admin: mọi giai đoạn; thường: qua dự án sở hữu)
async function getPhaseAuthorized(id, auth) {
  const rows = auth.isAdmin
    ? await sql`SELECT * FROM phases WHERE id = ${id}`
    : await sql`
        SELECT ph.* FROM phases ph
        JOIN projects p ON p.id = ph.project_id
        WHERE ph.id = ${id} AND p.user_id = ${auth.id}
      `;
  return rows[0] || null;
}

// Cập nhật giai đoạn. Body: { name?, goal?, start_date?, end_date?, status? }
export async function PUT(request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const phase = await getPhaseAuthorized(id, auth);
    if (!phase) {
      return NextResponse.json(
        { error: "Không tìm thấy giai đoạn" },
        { status: 404 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? phase.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên giai đoạn" },
        { status: 400 }
      );
    }
    const goal = body.goal === undefined ? phase.goal : String(body.goal || "");
    // Ngày: nhận giá trị mới nếu được gửi (chuỗi rỗng = xóa ngày), không gửi = giữ nguyên.
    // Gõ sai định dạng -> báo lỗi thay vì lặng lẽ xóa ngày.
    if (
      (body.start_date !== undefined && isInvalidDateInput(body.start_date)) ||
      (body.end_date !== undefined && isInvalidDateInput(body.end_date))
    ) {
      return NextResponse.json(
        { error: "Ngày không hợp lệ (định dạng YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const startDate =
      body.start_date === undefined
        ? toYMD(phase.start_date)
        : normalizeDate(body.start_date);
    const endDate =
      body.end_date === undefined
        ? toYMD(phase.end_date)
        : normalizeDate(body.end_date);
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" },
        { status: 400 }
      );
    }
    const status = PHASE_STATUSES.includes(body.status) ? body.status : phase.status;

    const rows = await sql`
      UPDATE phases
      SET name = ${name.slice(0, 150)}, goal = ${goal},
          start_date = ${startDate}, end_date = ${endDate}, status = ${status}
      WHERE id = ${id}
      RETURNING id, project_id, name, goal,
                start_date::text AS start_date, end_date::text AS end_date,
                status, created_at
    `;
    if (
      phase.name !== name ||
      phase.goal !== goal ||
      phase.status !== status ||
      toYMD(phase.start_date) !== startDate ||
      toYMD(phase.end_date) !== endDate
    ) {
      const proj = await sql`SELECT name FROM projects WHERE id = ${phase.project_id}`;
      await logActivity({
        userId: auth.id,
        projectId: phase.project_id,
        projectName: proj[0]?.name,
        taskLabel: name,
        action: phase.status !== status ? "po_phase_status_change" : "po_phase_update",
        field: phase.status !== status ? "status" : null,
        oldValue: phase.status !== status ? phase.status : null,
        newValue: phase.status !== status ? status : null,
      });
    }
    return NextResponse.json({ phase: rows[0] });
  } catch (e) {
    return serverError(e);
  }
}

// Xóa giai đoạn (hạng mục backlog gắn vào sẽ tự bỏ gắn nhờ ON DELETE SET NULL)
export async function DELETE(_request, { params }) {
  try {
    await ensureSchema();
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const id = Number(params.id);
    const phase = await getPhaseAuthorized(id, auth);
    if (!phase) {
      return NextResponse.json(
        { error: "Không tìm thấy giai đoạn" },
        { status: 404 }
      );
    }
    // Xóa TRƯỚC, ghi log SAU — để lịch sử không ghi nhận "đã xóa" khi lệnh xóa lỗi
    const proj = await sql`SELECT name FROM projects WHERE id = ${phase.project_id}`;
    await sql`DELETE FROM phases WHERE id = ${id}`;
    await logActivity({
      userId: auth.id,
      projectId: phase.project_id,
      projectName: proj[0]?.name,
      taskLabel: phase.name,
      action: "po_phase_delete",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
