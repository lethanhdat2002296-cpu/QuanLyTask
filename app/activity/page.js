"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";
import { STATUS_COLORS } from "@/lib/constants";
import { fetchProjectsCached } from "@/lib/clientCache";

function ymd(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function fmtDateTime(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("vi-VN");
}

function describe(a) {
  if (a.action === "create")
    return { icon: "📝", text: "Tạo task", color: "#2563eb" };
  if (a.action === "delete")
    return { icon: "🗑️", text: "Xóa task", color: "#dc2626" };
  if (a.action === "status_change") {
    if (a.new_value === "Hoàn thành")
      return { icon: "✅", text: "Hoàn thành", color: "#16a34a" };
    return {
      icon: "🔄",
      text: `${a.old_value || "?"} → ${a.new_value || "?"}`,
      color: STATUS_COLORS[a.new_value] || "#6b7280",
    };
  }
  if (a.action === "po_backlog_create")
    return { icon: "📦", text: "Tạo backlog", color: "#2563eb" };
  if (a.action === "po_backlog_update")
    return { icon: "✏️", text: "Sửa backlog", color: "#4f46e5" };
  if (a.action === "po_backlog_delete")
    return { icon: "🗑️", text: "Xóa backlog", color: "#dc2626" };
  if (a.action === "po_backlog_bucket_change")
    return { icon: "📌", text: `${a.old_value || "?"} → ${a.new_value || "?"}`, color: "#d97706" };
  if (a.action === "po_backlog_status_change")
    return { icon: "🔄", text: `${a.old_value || "?"} → ${a.new_value || "?"}`, color: "#2563eb" };
  if (a.action === "po_phase_create")
    return { icon: "🗺️", text: "Tạo giai đoạn", color: "#2563eb" };
  if (a.action === "po_phase_update")
    return { icon: "✏️", text: "Sửa giai đoạn", color: "#4f46e5" };
  if (a.action === "po_phase_delete")
    return { icon: "🗑️", text: "Xóa giai đoạn", color: "#dc2626" };
  if (a.action === "po_phase_status_change")
    return { icon: "🔄", text: `${a.old_value || "?"} → ${a.new_value || "?"}`, color: "#2563eb" };
  return { icon: "•", text: a.action, color: "#6b7280" };
}

const ACTION_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "create", label: "Tạo task" },
  { value: "delete", label: "Xóa task" },
  { value: "status_change", label: "Đổi trạng thái task" },
  { value: "po_backlog_create", label: "Tạo backlog" },
  { value: "po_backlog_bucket_change", label: "Đổi nhóm backlog" },
  { value: "po_backlog_status_change", label: "Đổi trạng thái backlog" },
  { value: "po_phase_create", label: "Tạo giai đoạn" },
  { value: "po_phase_status_change", label: "Đổi trạng thái giai đoạn" },
];

export default function ActivityPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectF, setProjectF] = useState("Tất cả");
  const [actionF, setActionF] = useState("");

  function preset(days) {
    if (days === null) {
      setFrom("");
      setTo("");
      return;
    }
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days + 1);
    setFrom(ymd(f));
    setTo(ymd(t));
  }

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (projectF !== "Tất cả") p.set("project", projectF);
      if (actionF) p.set("action", actionF);
      const res = await fetch("/api/activity?" + p.toString());
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setItems(data.activity || []);
    } catch {
      setError("Không tải được lịch sử");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjectsCached()
      .then((d) => d && setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, projectF, actionF]);

  return (
    <AppShell>
      <h1 className="page-title" style={{ marginBottom: 4 }}>
        Lịch sử hoạt động
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Dòng thời gian những việc bạn đã làm — tạo task, đổi trạng thái, hoàn thành.
        </p>

        {error && <div className="alert">{error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="filter-bar">
            <div className="filter-item">
              <span className="muted">Từ:</span>
              <input
                className="input"
                type="date"
                style={{ width: "auto" }}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <span className="muted">Đến:</span>
              <input
                className="input"
                type="date"
                style={{ width: "auto" }}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <span className="muted">Dự án:</span>
              <select
                className="select"
                style={{ width: "auto" }}
                value={projectF}
                onChange={(e) => setProjectF(e.target.value)}
              >
                <option>Tất cả</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <span className="muted">Loại:</span>
              <select
                className="select"
                style={{ width: "auto" }}
                value={actionF}
                onChange={(e) => setActionF(e.target.value)}
              >
                {ACTION_FILTERS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-item" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => preset(7)}>
                7 ngày
              </button>
              <button className="btn btn-sm" onClick={() => preset(30)}>
                30 ngày
              </button>
              <button className="btn btn-sm" onClick={() => preset(null)}>
                Tất cả
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 40, margin: 0 }}>🕒</p>
            <p>Chưa có hoạt động nào trong khoảng thời gian này.</p>
          </div>
        ) : (
          <div className="timeline">
            {items.map((a) => {
              const d = describe(a);
              return (
                <div className="tl-item" key={a.id}>
                  <span className="tl-dot" style={{ background: d.color }}>
                    {d.icon}
                  </span>
                  <div className="tl-body">
                    <div className="tl-line1">
                      <span className="tl-action" style={{ color: d.color }}>
                        {d.text}
                      </span>
                      {a.project_name && (
                        <span className="pill task-project">
                          🗂️ {a.project_name}
                        </span>
                      )}
                    </div>
                    <div className="tl-label">{a.task_label || "(task)"}</div>
                    <div className="tl-time muted">{fmtDateTime(a.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </AppShell>
  );
}
