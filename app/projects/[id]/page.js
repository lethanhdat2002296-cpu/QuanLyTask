"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import TaskModal from "@/components/TaskModal";
import { TASK_STATUSES, STATUS_COLORS } from "@/lib/constants";

function Block({ label, value }) {
  return (
    <div className="block">
      <div className="label">{label}</div>
      <div className={"value" + (value ? "" : " empty")}>
        {value || "—"}
      </div>
    </div>
  );
}

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
    if (!confirm("Xóa task này?")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    load();
  }

  const visibleTasks =
    filter === "Tất cả" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <>
      <Topbar />
      <div className="container">
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
              <button className="btn btn-primary" onClick={openCreate}>
                + Thêm task
              </button>
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
                <div className="task" key={t.id}>
                  <div className="task-head">
                    <div className="task-title">{t.customer_task}</div>
                    <span
                      className="badge"
                      style={{
                        background: STATUS_COLORS[t.status] || "#6b7280",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="task-grid">
                    <Block label="Đặt câu hỏi" value={t.question} />
                    <Block label="Khách trả lời" value={t.customer_answer} />
                    <Block label="Giải pháp" value={t.solution} />
                  </div>
                  <div className="task-actions">
                    <span className="muted" style={{ fontSize: 13 }}>
                      Đổi trạng thái:
                    </span>
                    <select
                      className="select"
                      style={{ width: "auto" }}
                      value={t.status}
                      onChange={(e) => changeStatus(t.id, e.target.value)}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm"
                      onClick={() => openEdit(t)}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteTask(t.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        ) : null}
      </div>

      {showModal && (
        <TaskModal
          projectId={projectId}
          task={modalTask}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
