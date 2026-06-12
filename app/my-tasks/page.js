"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";
import TaskCard from "@/components/TaskCard";
import TaskModal from "@/components/TaskModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { TASK_STATUSES } from "@/lib/constants";
import { fetchProjectsCached } from "@/lib/clientCache";

export default function MyTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Bộ lọc
  const [view, setView] = useState("open"); // open | done | all
  const [statusF, setStatusF] = useState("Tất cả");
  const [projectF, setProjectF] = useState("Tất cả");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState("default");
  const [q, setQ] = useState("");

  const [modalTask, setModalTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [notice, setNotice] = useState(null); // { text, url } sau khi xuất Notion

  function buildQuery() {
    const p = new URLSearchParams();
    if (view === "open") p.set("done", "0");
    if (view === "done") p.set("done", "1");
    if (statusF !== "Tất cả") p.set("status", statusF);
    if (projectF !== "Tất cả") p.set("project", projectF);
    if (overdueOnly) p.set("overdue", "1");
    if (sort !== "default") p.set("sort", sort);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?" + buildQuery());
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      setError("Không tải được công việc");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const data = await fetchProjectsCached();
      setProjects(data.projects || []);
    } catch {}
  }

  useEffect(() => {
    loadProjects();
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("overdue") === "1") setOverdueOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, statusF, projectF, overdueOnly, sort, q]);

  async function changeStatus(taskId, status) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }
  async function deleteTask(taskId) {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setDeleteTaskTarget(null);
    load();
  }
  async function exportNotion(task) {
    setError("");
    setNotice(null);
    const res = await fetch("/api/notion/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "task", id: task.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Không xuất được sang Notion");
      return;
    }
    setNotice({
      text: data.updated ? "Đã cập nhật trên Notion ✓" : "Đã tạo trên Notion ✓",
      url: data.url,
    });
  }
  function openEdit(task) {
    setModalTask(task);
    setShowModal(true);
  }
  function onSaved() {
    setShowModal(false);
    setModalTask(null);
    load();
  }

  const overdueCount = tasks.filter((t) => t.is_overdue).length;

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 className="page-title">Công việc của tôi</h1>
          {overdueCount > 0 && (
            <span className="badge badge-overdue">
              {overdueCount} task quá hạn
            </span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Tất cả task tồn đọng của bạn ở mọi dự án — gấp/quá hạn xếp lên đầu.
        </p>

        {error && <div className="alert">{error}</div>}
        {notice && (
          <div className="alert-success">
            {notice.text}
            {notice.url && (
              <a href={notice.url} target="_blank" rel="noopener noreferrer">
                Mở Notion ↗
              </a>
            )}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <input
            className="input"
            style={{ marginBottom: 14 }}
            placeholder="🔍 Tìm task theo nội dung, câu hỏi, trả lời, giải pháp..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="filter-bar">
            <div className="filter-item">
              <span className="muted">Hiển thị:</span>
              <select
                className="select"
                style={{ width: "auto" }}
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="open">Chưa xong</option>
                <option value="done">Đã xong</option>
                <option value="all">Tất cả</option>
              </select>
            </div>
            <div className="filter-item">
              <span className="muted">Trạng thái:</span>
              <select
                className="select"
                style={{ width: "auto" }}
                value={statusF}
                onChange={(e) => setStatusF(e.target.value)}
              >
                <option>Tất cả</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
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
              <span className="muted">Sắp xếp:</span>
              <select
                className="select"
                style={{ width: "auto" }}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="default">Mặc định (gấp trước)</option>
                <option value="end_date">Hạn gần nhất</option>
                <option value="priority">Ưu tiên</option>
                <option value="created_at">Mới tạo nhất</option>
              </select>
            </div>
            <label className="filter-item" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              <span>Chỉ quá hạn</span>
            </label>
          </div>
        </div>

        <div className="row-between" style={{ marginBottom: 12 }}>
          <span className="muted">{tasks.length} task</span>
        </div>

        {loading ? (
          <Skeleton />
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 40, margin: 0 }}>🎉</p>
            <p>Không có task nào khớp bộ lọc. Tồn đọng sạch sẽ!</p>
          </div>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              showProject
              onEdit={openEdit}
              onDelete={setDeleteTaskTarget}
              onStatusChange={changeStatus}
              onExportNotion={exportNotion}
            />
          ))
        )}

      {showModal && (
        <TaskModal
          projectId={modalTask?.project_id}
          task={modalTask}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTaskTarget)}
        title="Xóa task?"
        message={deleteTaskTarget ? `Task "${deleteTaskTarget.title || deleteTaskTarget.customer_task}" sẽ bị xóa.` : ""}
        confirmText="Xóa"
        danger
        onCancel={() => setDeleteTaskTarget(null)}
        onConfirm={() => deleteTask(deleteTaskTarget.id)}
      />
    </AppShell>
  );
}
