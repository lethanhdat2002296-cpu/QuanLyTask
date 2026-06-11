"use client";

import { useState } from "react";
import {
  TASK_STATUSES,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";

function fmtDate(v) {
  if (!v) return "";
  const s = String(v);
  // Chuỗi ngày thuần YYYY-MM-DD -> hiểu là ngày địa phương (tránh lệch múi giờ).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN");
}

// Tiêu đề ngắn từ dòng đầu nội dung (cho task cũ chưa có cột title)
function firstLine(text) {
  if (!text) return "";
  const line =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "";
  const cleaned = line.replace(/^[-•*\d.\s)]+/, "").trim();
  return (cleaned || line).slice(0, 100);
}

function Child({ color, icon, label, value }) {
  return (
    <div className="child">
      <div className="child-label" style={{ color }}>
        <span>{icon}</span>
        {label}
      </div>
      <div
        className={"child-value" + (value ? "" : " empty")}
        style={{ borderLeftColor: color }}
      >
        {value || "Chưa có"}
      </div>
    </div>
  );
}

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onExportNotion,
  showProject = false,
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const text = task.customer_task || "";
  const displayTitle =
    (task.title && task.title.trim()) || firstLine(text) || "(không tiêu đề)";
  const isLong = text.length > 260 || text.split("\n").length > 6;
  const prioLabel = PRIORITY_LABELS[task.priority] || "Trung bình";
  const prioColor = PRIORITY_COLORS[task.priority] || "#d97706";

  return (
    <div className={"task" + (open ? " task-open" : "")}>
      <button
        className="task-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="task-chevron">{open ? "▾" : "▸"}</span>
        {showProject && task.project_name && (
          <span className="pill task-project">🗂️ {task.project_name}</span>
        )}
        <span className="task-preview">{displayTitle}</span>
        {task.is_overdue && <span className="badge badge-overdue">Quá hạn</span>}
        {!task.is_overdue && task.is_due_soon && (
          <span className="badge badge-soon">Sắp đến hạn</span>
        )}
        <span
          className="prio-chip"
          style={{ color: prioColor, borderColor: prioColor }}
          title={"Ưu tiên: " + prioLabel}
        >
          ⚑ {prioLabel}
        </span>
        <span
          className="badge"
          style={{ background: STATUS_COLORS[task.status] || "#6b7280" }}
        >
          {task.status}
        </span>
      </button>

      {open && (
        <div className="task-detail">
          <div className="task-meta">
            <span className="pill">🗓️ Tạo: {fmtDate(task.created_at)}</span>
            {task.end_date && (
              <span className="pill">🏁 Hạn: {fmtDate(task.end_date)}</span>
            )}
            {task.completed_at && (
              <span className="pill pill-done">
                🏆 Hoàn thành: {fmtDate(task.completed_at)}
              </span>
            )}
            <span className="pill">⚑ Ưu tiên: {prioLabel}</span>
            {task.doc_link && (
              <a
                className="pill pill-link"
                href={task.doc_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                📎 Tài liệu
              </a>
            )}
          </div>
          {text.trim() && (
            <>
              <span className="parent-tag">📋 Nội dung khách hàng</span>
              <div
                className={"parent-body" + (isLong && !expanded ? " clamp" : "")}
              >
                {text}
              </div>
              {isLong && (
                <button
                  className="link-btn"
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? "Thu gọn ▲" : "Xem thêm ▼"}
                </button>
              )}
            </>
          )}

          <div className="children">
            <Child
              color="#d97706"
              icon="❓"
              label="Đặt câu hỏi"
              value={task.question}
            />
            <Child
              color="#2563eb"
              icon="💬"
              label="Khách trả lời"
              value={task.customer_answer}
            />
            <Child
              color="#16a34a"
              icon="✅"
              label="Giải pháp"
              value={task.solution}
            />
          </div>

          <div className="task-actions">
            <span className="muted" style={{ fontSize: 13 }}>
              Trạng thái:
            </span>
            <select
              className="select"
              style={{ width: "auto" }}
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => onEdit(task)}>
              Sửa
            </button>
            {onExportNotion && (
              <button className="btn btn-sm" onClick={() => onExportNotion(task)}>
                Xuất Notion
              </button>
            )}
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onDelete(task)}
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
