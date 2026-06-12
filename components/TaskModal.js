"use client";

import { useEffect, useState } from "react";
import {
  TASK_STATUSES,
  DEFAULT_STATUS,
  PRIORITIES,
  DEFAULT_PRIORITY,
} from "@/lib/constants";

// Đóng modal bằng phím Esc
function useEscClose(onClose) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// Gợi ý tiêu đề ngắn từ dòng đầu của nội dung (cho task cũ chưa có tiêu đề).
// Chỉ bỏ ký hiệu đầu dòng dạng "- ", "1. " — không ăn mất số có nghĩa.
function firstLine(text) {
  if (!text) return "";
  const line =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "";
  const cleaned = line.replace(/^(?:[-•*]|\d{1,3}[.)])\s+/, "").trim();
  return (cleaned || line).slice(0, 90);
}

export default function TaskModal({ projectId, task, onClose, onSaved }) {
  const isEdit = Boolean(task);
  const [form, setForm] = useState({
    title: task?.title?.trim() ? task.title : firstLine(task?.customer_task),
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
  const [suggesting, setSuggesting] = useState(false);
  const [aiHint, setAiHint] = useState("");
  useEscClose(onClose);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Nhờ AI (Gemini) gợi ý ưu tiên + giải pháp dựa trên tài liệu tham khảo dự án.
  async function aiSuggest() {
    const pid = projectId || task?.project_id;
    if (!pid) {
      setError("Không xác định được dự án để gợi ý.");
      return;
    }
    setSuggesting(true);
    setError("");
    setAiHint("");
    try {
      const res = await fetch(`/api/projects/${pid}/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          customer_task: form.customer_task,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không gợi ý được, thử lại sau.");
        return;
      }
      setForm((f) => ({
        ...f,
        priority: [1, 2, 3].includes(Number(data.priority))
          ? Number(data.priority)
          : f.priority,
        solution: data.solution || f.solution,
        question: data.questions || f.question,
      }));
      setAiHint(data.priorityReason || "");
    } catch {
      setError("Không gợi ý được, thử lại sau.");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Vui lòng nhập Tiêu đề task");
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
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
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
          <div className="ai-box">
            <button
              type="button"
              className="btn btn-sm btn-ai"
              onClick={aiSuggest}
              disabled={suggesting || saving}
            >
              {suggesting ? "Đang gợi ý..." : "✨ Gợi ý bằng AI"}
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Điền tiêu đề/nội dung rồi bấm để AI đề xuất ưu tiên + giải pháp
              (dựa trên tài liệu dự án).
            </span>
          </div>
          <div className="field">
            <label>Tiêu đề task * (ngắn gọn, hiện trong danh sách)</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
              maxLength={150}
              placeholder="VD: Quản lý số sê-ri sản phẩm Apple khi đóng gói"
            />
          </div>
          <div className="field">
            <label>Nội dung / yêu cầu khách hàng</label>
            <textarea
              className="textarea"
              value={form.customer_task}
              onChange={(e) => set("customer_task", e.target.value)}
              placeholder="Mô tả chi tiết yêu cầu khách hàng đưa ra (không bắt buộc)"
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
          <div className="field-row">
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
          </div>
          {aiHint && (
            <p className="muted" style={{ fontSize: 13, margin: "-6px 0 12px" }}>
              💡 Lý do AI gợi ý: {aiHint}
            </p>
          )}
          <div className="field-row">
            <div className="field">
              <label>Ngày hết hạn</label>
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
                type="text"
                inputMode="url"
                value={form.doc_link}
                onChange={(e) => set("doc_link", e.target.value)}
                placeholder="drive.google.com/..."
              />
            </div>
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
