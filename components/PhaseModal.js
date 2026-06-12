"use client";

import { useEffect, useState } from "react";
import { PHASE_STATUSES, DEFAULT_PHASE_STATUS } from "@/lib/constants";

// Modal thêm/sửa giai đoạn phát triển (chế độ PO).
export default function PhaseModal({ projectId, phase, onClose, onSaved }) {
  const isEdit = Boolean(phase);
  const [form, setForm] = useState({
    name: phase?.name || "",
    goal: phase?.goal || "",
    start_date: (phase?.start_date || "").slice(0, 10),
    end_date: (phase?.end_date || "").slice(0, 10),
    status: phase?.status || DEFAULT_PHASE_STATUS,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Đóng modal bằng phím Esc
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Vui lòng nhập tên giai đoạn");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = isEdit ? `/api/po/phases/${phase.id}` : `/api/po/phases`;
      const body = isEdit ? form : { ...form, project_id: Number(projectId) };
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
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Sửa giai đoạn" : "Thêm giai đoạn phát triển"}</h2>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Tên giai đoạn *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
              maxLength={150}
              placeholder="VD: GĐ1 — MVP (bản chạy được đầu tiên)"
            />
          </div>
          <div className="field">
            <label>Mục tiêu giai đoạn</label>
            <textarea
              className="textarea"
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="VD: Khách đóng gói được hàng và quét serial không lỗi"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Ngày bắt đầu</label>
              <input
                className="input"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Ngày kết thúc (dự kiến)</label>
              <input
                className="input"
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Trạng thái</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {PHASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Hủy
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm giai đoạn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
