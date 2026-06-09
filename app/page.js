"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      setError("Không tải được danh sách dự án");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProject(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Tạo dự án thất bại");
        return;
      }
      setName("");
      setDescription("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(e, id) {
    e.stopPropagation();
    if (!confirm("Xóa dự án này cùng toàn bộ task bên trong?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <Topbar />
      <div className="container">
        <div className="row-between" style={{ marginBottom: 22 }}>
          <h1 className="page-title">Dự án của bạn</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Tạo dự án
          </button>
        </div>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <p className="muted">Đang tải...</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 40, margin: 0 }}>🗂️</p>
            <p>Chưa có dự án nào. Bấm “+ Tạo dự án” để bắt đầu.</p>
          </div>
        ) : (
          <div className="grid">
            {projects.map((p) => (
              <div
                key={p.id}
                className="card project-card"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <div className="row-between">
                  <h3>{p.name}</h3>
                </div>
                <div className="desc">{p.description || "Không có mô tả"}</div>
                <div className="row-between" style={{ marginTop: 6 }}>
                  <span className="pill">
                    {p.task_count} task · {p.done_count} hoàn thành
                  </span>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => deleteProject(e, p.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Tạo dự án mới</h2>
            <form onSubmit={createProject}>
              <div className="field">
                <label>Tên dự án *</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  placeholder="VD: Dự án website khách hàng A"
                />
              </div>
              <div className="field">
                <label>Mô tả</label>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về dự án (không bắt buộc)"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Đang lưu..." : "Tạo dự án"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
