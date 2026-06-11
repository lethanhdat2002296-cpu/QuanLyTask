"use client";

import { useEffect, useState } from "react";
import {
  BACKLOG_BUCKETS,
  BACKLOG_STATUSES,
  DEFAULT_BUCKET,
  DEFAULT_BACKLOG_STATUS,
  VALUE_LABELS,
  EFFORT_LABELS,
} from "@/lib/constants";

// Modal thêm/sửa hạng mục backlog (chế độ PO).
// projects: danh sách dự án để chọn; defaultProjectId: dự án đang lọc (nếu có).
export default function BacklogModal({
  projects = [],
  defaultProjectId,
  item,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    project_id: item?.project_id || defaultProjectId || projects[0]?.id || "",
    title: item?.title || "",
    user_story: item?.user_story || "",
    acceptance_criteria: item?.acceptance_criteria || "",
    note: item?.note || "",
    business_value: item?.business_value || 2,
    effort: item?.effort || 2,
    bucket: item?.bucket || DEFAULT_BUCKET,
    status: item?.status || DEFAULT_BACKLOG_STATUS,
    phase_id: item?.phase_id || "",
  });
  const [phases, setPhases] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiHint, setAiHint] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Nạp danh sách giai đoạn của dự án đang chọn (cho ô "Giai đoạn")
  useEffect(() => {
    const pid = Number(form.project_id);
    if (!pid) {
      setPhases([]);
      return;
    }
    let alive = true;
    fetch(`/api/po/phases?project=${pid}`)
      .then((r) => (r.ok ? r.json() : { phases: [] }))
      .then((d) => alive && setPhases(d.phases || []))
      .catch(() => alive && setPhases([]));
    return () => {
      alive = false;
    };
  }, [form.project_id]);

  // Nhờ AI (vai PO) viết user story + tiêu chí chấp nhận + chấm giá trị
  async function aiSuggest() {
    const pid = Number(form.project_id);
    if (!pid) {
      setError("Hãy chọn dự án trước khi nhờ AI gợi ý.");
      return;
    }
    setSuggesting(true);
    setError("");
    setAiHint("");
    try {
      const res = await fetch(`/api/po/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: pid,
          title: form.title,
          note: form.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không gợi ý được, thử lại sau.");
        return;
      }
      setForm((f) => ({
        ...f,
        user_story: data.user_story || f.user_story,
        acceptance_criteria: data.acceptance_criteria || f.acceptance_criteria,
        business_value: [1, 2, 3].includes(Number(data.business_value))
          ? Number(data.business_value)
          : f.business_value,
      }));
      setAiHint(data.valueReason || "");
    } catch {
      setError("Không gợi ý được, thử lại sau.");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Vui lòng nhập tiêu đề hạng mục");
      return;
    }
    if (!isEdit && !Number(form.project_id)) {
      setError("Vui lòng chọn dự án");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = isEdit ? `/api/po/backlog/${item.id}` : `/api/po/backlog`;
      const body = {
        ...form,
        project_id: Number(form.project_id),
        phase_id: Number(form.phase_id) || null,
        business_value: Number(form.business_value),
        effort: Number(form.effort),
      };
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Lưu thất bại");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Sửa hạng mục backlog" : "Thêm hạng mục backlog"}</h2>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Dự án / sản phẩm *</label>
            <select
              className="select"
              value={form.project_id}
              onChange={(e) => {
                set("project_id", e.target.value);
                set("phase_id", ""); // đổi dự án thì bỏ gắn giai đoạn cũ
              }}
              disabled={isEdit}
            >
              {!form.project_id && <option value="">— Chọn dự án —</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
              padding: "10px 12px",
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              borderRadius: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-sm"
              onClick={aiSuggest}
              disabled={suggesting || saving}
              style={{
                background: "#4f46e5",
                color: "#fff",
                borderColor: "#4f46e5",
              }}
            >
              {suggesting ? "Đang gợi ý..." : "✨ AI viết User story & Tiêu chí"}
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Nhập tiêu đề (và ghi chú nếu có) rồi bấm — AI vai PO sẽ viết giúp,
              dựa trên tài liệu dự án.
            </span>
          </div>

          <div className="field">
            <label>Tiêu đề hạng mục *</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
              maxLength={200}
              placeholder="VD: Báo cáo số serial đã đóng gói theo ngày"
            />
          </div>
          <div className="field">
            <label>User story</label>
            <textarea
              className="textarea"
              value={form.user_story}
              onChange={(e) => set("user_story", e.target.value)}
              placeholder='VD: "Là thủ kho, tôi muốn xem báo cáo serial theo ngày, để đối chiếu cuối tháng nhanh hơn."'
            />
          </div>
          <div className="field">
            <label>Tiêu chí chấp nhận (mỗi dòng 1 tiêu chí)</label>
            <textarea
              className="textarea"
              value={form.acceptance_criteria}
              onChange={(e) => set("acceptance_criteria", e.target.value)}
              placeholder={"VD:\n- Khi chọn khoảng ngày thì hiển thị đúng tổng số serial\n- Khi không có dữ liệu thì hiển thị 0"}
            />
          </div>
          <div className="field">
            <label>Giá trị kinh doanh</label>
            <select
              className="select"
              value={form.business_value}
              onChange={(e) => set("business_value", Number(e.target.value))}
            >
              {[1, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {VALUE_LABELS[v]}
                </option>
              ))}
            </select>
            {aiHint && (
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                💡 Lý do AI chấm giá trị: {aiHint}
              </p>
            )}
          </div>
          <div className="field">
            <label>Công sức ước lượng</label>
            <select
              className="select"
              value={form.effort}
              onChange={(e) => set("effort", Number(e.target.value))}
            >
              {[1, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {EFFORT_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nhóm ưu tiên (PO)</label>
            <select
              className="select"
              value={form.bucket}
              onChange={(e) => set("bucket", e.target.value)}
            >
              {BACKLOG_BUCKETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Trạng thái</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {BACKLOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Giai đoạn phát triển</label>
            <select
              className="select"
              value={form.phase_id || ""}
              onChange={(e) => set("phase_id", e.target.value)}
            >
              <option value="">— Chưa gắn giai đoạn —</option>
              {phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ghi chú</label>
            <textarea
              className="textarea"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Bối cảnh, mô tả thêm (không bắt buộc)"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Hủy
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm hạng mục"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
