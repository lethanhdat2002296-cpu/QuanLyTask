"use client";

import { useState } from "react";
import { TASK_STATUSES, STATUS_COLORS } from "@/lib/constants";

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

export default function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const text = task.customer_task || "";
  const isLong = text.length > 260 || text.split("\n").length > 6;

  return (
    <div className="task">
      <div className="task-head">
        <span className="parent-tag">📋 Task khách hàng</span>
        <span
          className="badge"
          style={{ background: STATUS_COLORS[task.status] || "#6b7280" }}
        >
          {task.status}
        </span>
      </div>

      <div className={"parent-body" + (isLong && !expanded ? " clamp" : "")}>
        {text}
      </div>
      {isLong && (
        <button className="link-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Thu gọn ▲" : "Xem thêm ▼"}
        </button>
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
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(task.id)}>
          Xóa
        </button>
      </div>
    </div>
  );
}
