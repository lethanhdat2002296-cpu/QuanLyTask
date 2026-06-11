"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TaskModal from "@/components/TaskModal";
import TaskCard from "@/components/TaskCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import { TASK_STATUSES } from "@/lib/constants";

export default function ProjectDetailPage({ params }) {
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalTask, setModalTask] = useState(null); // task đang sửa
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("Tất cả");
  const [refDocs, setRefDocs] = useState(""); // tài liệu tham khảo dự án
  const [docsOpen, setDocsOpen] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsMsg, setDocsMsg] = useState("");
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    reference_docs: "",
  });
  const [savingProject, setSavingProject] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/tasks`),
      ]);
      if (pRes.status === 401 || tRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (pRes.status === 404) {
        setError("Không tìm thấy dự án");
        setLoading(false);
        return;
      }
      const pData = await pRes.json();
      const tData = await tRes.json();
      setProject(pData.project);
      setRefDocs(pData.project?.reference_docs || "");
      setTasks(tData.tasks || []);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openCreate() {
    setModalTask(null);
    setShowModal(true);
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
    if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
  }

  function openProjectEdit() {
    setProjectForm({
      name: project?.name || "",
      description: project?.description || "",
      reference_docs: refDocs || "",
    });
    setEditingProject(true);
  }

  async function saveProject(e) {
    e.preventDefault();
    if (!projectForm.name.trim()) return;
    setSavingProject(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Lưu dự án thất bại");
        return;
      }
      setProject(data.project);
      setRefDocs(data.project?.reference_docs || "");
      setEditingProject(false);
    } finally {
      setSavingProject(false);
    }
  }

  async function saveDocs() {
    if (!project) return;
    setSavingDocs(true);
    setDocsMsg("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          description: project.description || "",
          reference_docs: refDocs,
        }),
      });
      if (res.ok) {
        setProject((p) => ({ ...p, reference_docs: refDocs }));
        setDocsMsg("Đã lưu tài liệu ✓");
      } else {
        const d = await res.json().catch(() => ({}));
        setDocsMsg(d.error || "Lưu thất bại");
      }
    } catch {
      setDocsMsg("Lưu thất bại");
    } finally {
      setSavingDocs(false);
    }
  }

  const visibleTasks =
    filter === "Tất cả" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <AppShell>
      <div style={{ marginBottom: 8 }}>
        <span
            className="link"
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/")}
          >
            ← Về danh sách dự án
          </span>
        </div>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <p className="muted">Đang tải...</p>
        ) : project ? (
          <>
            <div className="row-between" style={{ marginBottom: 18 }}>
              <div>
                <h1 className="page-title">{project.name}</h1>
                {project.description && (
                  <p className="muted">{project.description}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={openCreate}>
                  + Thêm task
                </button>
                <button className="btn" onClick={openProjectEdit}>
                  Sửa dự án
                </button>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                background: "#fff",
              }}
            >
              <button
                className="link-btn"
                onClick={() => setDocsOpen((o) => !o)}
                style={{ fontWeight: 600 }}
              >
                {docsOpen ? "▾" : "▸"} 📚 Tài liệu tham khảo dự án{" "}
                <span
                  className="muted"
                  style={{ fontWeight: 400, fontSize: 13 }}
                >
                  (AI dùng làm ngữ cảnh khi gợi ý task)
                </span>
              </button>
              {docsOpen && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 160 }}
                    value={refDocs}
                    onChange={(e) => setRefDocs(e.target.value)}
                    placeholder="Dán tài liệu / quy trình / yêu cầu của dự án (SAP, Odoo, ghi chú nghiệp vụ...) để AI hiểu ngữ cảnh và gợi ý sát hơn."
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                    }}
                  >
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={saveDocs}
                      disabled={savingDocs}
                    >
                      {savingDocs ? "Đang lưu..." : "Lưu tài liệu"}
                    </button>
                    {docsMsg && (
                      <span className="muted" style={{ fontSize: 13 }}>
                        {docsMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="row-between" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="muted">Lọc trạng thái:</span>
                <select
                  className="select"
                  style={{ width: "auto" }}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>Tất cả</option>
                  {TASK_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <span className="muted">{visibleTasks.length} task</span>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 40, margin: 0 }}>📝</p>
                <p>Chưa có task nào. Bấm “+ Thêm task” để tạo.</p>
              </div>
            ) : (
              visibleTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onEdit={openEdit}
                  onDelete={setDeleteTaskTarget}
                  onStatusChange={changeStatus}
                  onExportNotion={exportNotion}
                />
              ))
            )}
          </>
        ) : null}

      {showModal && (
        <TaskModal
          projectId={projectId}
          task={modalTask}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
      {editingProject && (
        <div className="modal-overlay" onClick={() => setEditingProject(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sửa dự án</h2>
            <form onSubmit={saveProject}>
              <div className="field">
                <label>Tên dự án *</label>
                <input
                  className="input"
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm((f) => ({ ...f, name: e.target.value }))
                  }
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Mô tả</label>
                <textarea
                  className="textarea"
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Tài liệu tham khảo</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 140 }}
                  value={projectForm.reference_docs}
                  onChange={(e) =>
                    setProjectForm((f) => ({ ...f, reference_docs: e.target.value }))
                  }
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditingProject(false)}>
                  Hủy
                </button>
                <button className="btn btn-primary" disabled={savingProject}>
                  {savingProject ? "Đang lưu..." : "Lưu dự án"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
