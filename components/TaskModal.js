"use client";

import { useState } from "react";
import {
  TASK_STATUSES,
  DEFAULT_STATUS,
  PRIORITIES,
  DEFAULT_PRIORITY,
} from "@/lib/constants";

export default function TaskModal({ projectId, task, onClose, onSaved }) {
  const isEdit = Boolean(task);
  const [form, setForm] = useState({
    customer_task: task?.customer_task || "",
    question: task?.question || "",
    customer_answer: task?.customer_answer || "",
    solution: task?.solution || "",
    status: task?.status || DEFAULT_STATUS,
    priority: task?.priority || DEFAULT_PRIORITY,
    end_date: (task?.end_date || "").slice(0, 10),
    doc_link: task?.doc_link || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.customer_task.trim()) {
      setError("Vui lòng nhập nội dung Task khách hàng");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = isEdit
        ? `/api/tasks/${task.id}`
        : `/api/projects/${projectId}/tasks`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <h2>{isEdit ? "Sửa task" : "Thêm task mới"}</h2>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Task khách hàng *</label>
            <textarea
              className="textarea"
              value={form.customer_task}
              onChange={(e) => set("customer_task", e.target.value)}
              autoFocus
              placeholder="Yêu cầu / nội dung khách hàng đưa ra"
            />
          </div>
          <div className="field">
            <label>Đặt câu hỏi</label>
            <textarea
              className="textarea"
              value={form.question}
              onChange={(e) => set("question", e.target.value)}
              placeholder="Câu hỏi cần làm rõ với khách"
            />
          </div>
          <div className="field">
            <label>Khách trả lời</label>
            <textarea
              className="textarea"
              value={form.customer_answer}
              onChange={(e) => set("customer_answer", e.target.value)}
              placeholder="Phản hồi của khách hàng"
            />
          </div>
          <div className="field">
            <label>Giải pháp</label>
            <textarea
              className="textarea"
              value={form.solution}
              onChange={(e) => set("solution", e.target.value)}
              placeholder="Hướng giải quyết / giải pháp đề xuất"
            />
          </div>
          <div className="field">
            <label>Trạng thái</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Mức độ ưu tiên</label>
            <select
              className="select"
              value={form.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ngày kết thúc</label>
            <input
              className="input"
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Link tài liệu</label>
            <input
              className="input"
              type="url"
              value={form.doc_link}
              onChange={(e) => set("doc_link", e.target.value)}
              placeholder="https://drive.google.com/... (không bắt buộc)"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Hủy
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
