"use client";

import { useState } from "react";
import {
  BACKLOG_BUCKETS,
  BACKLOG_STATUSES,
  BACKLOG_STATUS_COLORS,
  BUCKET_LABELS,
  VALUE_LABELS,
  EFFORT_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("vi-VN");
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

// Thẻ hạng mục backlog (chế độ PO) — accordion giống TaskCard.
export default function BacklogCard({
  item,
  onEdit,
  onDelete,
  onBucketChange,
  onStatusChange,
  onMove,
  onExportNotion,
  onToTask,
  canMoveUp = false,
  canMoveDown = false,
  showProject = false,
}) {
  const [open, setOpen] = useState(false);
  const valueLabel = VALUE_LABELS[item.business_value] || "Trung bình";
  const valueColor = PRIORITY_COLORS[item.business_value] || "#0d9488";
  const effortLabel = EFFORT_LABELS[item.effort] || "Vừa";

  return (
    <div className={"task" + (open ? " task-open" : "")}>
      <button
        className="task-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="task-chevron">▸</span>
        {showProject && item.project_name && (
          <span className="pill task-project">🗂️ {item.project_name}</span>
        )}
        <span className="task-preview">{item.title}</span>
        <span
          className="prio-chip"
          style={{ color: valueColor, borderColor: valueColor }}
          title={"Giá trị kinh doanh: " + valueLabel}
        >
          💎 {valueLabel}
        </span>
        <span
          className="badge"
          style={{ background: BACKLOG_STATUS_COLORS[item.status] || "#6b7280" }}
        >
          {item.status}
        </span>
      </button>

      {open && (
        <div className="task-detail">
          <div className="task-meta">
            <span className="pill">🗓️ Tạo: {fmtDate(item.created_at)}</span>
            <span className="pill">
              📌 Nhóm: {BUCKET_LABELS[item.bucket] || item.bucket}
            </span>
            <span className="pill">🔧 Công sức: {effortLabel}</span>
            {item.phase_name && (
              <span className="pill">🗺️ Giai đoạn: {item.phase_name}</span>
            )}
            {item.task_id && (
              <span className="pill pill-done" title="Hạng mục đã được chuyển thành task thực thi bên chế độ BA">
                🔗 Đã có task BA #{item.task_id}
              </span>
            )}
          </div>

          <div className="children">
            <Child
              color="#4f46e5"
              icon="📖"
              label="User story"
              value={item.user_story}
            />
            <Child
              color="#0d9488"
              icon="✅"
              label="Tiêu chí chấp nhận"
              value={item.acceptance_criteria}
            />
            <Child color="#6b7280" icon="📝" label="Ghi chú" value={item.note} />
          </div>

          <div className="task-actions">
            <span className="muted" style={{ fontSize: 13 }}>
              Nhóm:
            </span>
            <select
              className="select"
              style={{ width: "auto" }}
              value={item.bucket}
              onChange={(e) => onBucketChange(item.id, e.target.value)}
            >
              {BACKLOG_BUCKETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: 13 }}>
              Trạng thái:
            </span>
            <select
              className="select"
              style={{ width: "auto" }}
              value={item.status}
              onChange={(e) => onStatusChange(item.id, e.target.value)}
            >
              {BACKLOG_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => onEdit(item)}>
              Sửa
            </button>
            {onMove && (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => onMove(item, -1)}
                  disabled={!canMoveUp}
                  title="Đưa lên trên trong nhóm"
                >
                  ↑
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => onMove(item, 1)}
                  disabled={!canMoveDown}
                  title="Đưa xuống dưới trong nhóm"
                >
                  ↓
                </button>
              </>
            )}
            {onToTask && !item.task_id && (
              <button
                className="btn btn-sm"
                onClick={() => onToTask(item)}
                title="Tạo task thực thi bên chế độ BA từ hạng mục này (nối PO → BA)"
              >
                → Tạo task BA
              </button>
            )}
            {onExportNotion && (
              <button className="btn btn-sm" onClick={() => onExportNotion(item)}>
                Xuất Notion
              </button>
            )}
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onDelete(item)}
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
