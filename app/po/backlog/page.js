"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import BacklogCard from "@/components/BacklogCard";
import BacklogModal from "@/components/BacklogModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BACKLOG_BUCKETS, BACKLOG_STATUSES } from "@/lib/constants";

export default function BacklogPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Bộ lọc
  const [projectF, setProjectF] = useState("Tất cả");
  const [bucketF, setBucketF] = useState("Tất cả");
  const [statusF, setStatusF] = useState("Tất cả");
  const [q, setQ] = useState("");

  const [modalItem, setModalItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [notice, setNotice] = useState(null); // { text, url } sau khi xuất Notion

  function buildQuery() {
    const p = new URLSearchParams();
    if (projectF !== "Tất cả") p.set("project", projectF);
    if (bucketF !== "Tất cả") p.set("bucket", bucketF);
    if (statusF !== "Tất cả") p.set("status", statusF);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/po/backlog?" + buildQuery());
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError("Không tải được backlog");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects || []);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectF, bucketF, statusF, q]);

  async function changeBucket(id, bucket) {
    await fetch(`/api/po/backlog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket }),
    });
    load();
  }
  async function changeStatus(id, status) {
    await fetch(`/api/po/backlog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }
  async function deleteItem(id) {
    await fetch(`/api/po/backlog/${id}`, { method: "DELETE" });
    setDeleteItemTarget(null);
    load();
  }
  async function exportNotion(item) {
    setError("");
    setNotice(null);
    const res = await fetch("/api/notion/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "backlog", id: item.id }),
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
  async function moveItem(item, dir) {
    const sameBucket = items.filter((i) => i.bucket === item.bucket);
    const idx = sameBucket.findIndex((i) => i.id === item.id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= sameBucket.length) return;
    const reordered = [...sameBucket];
    [reordered[idx], reordered[nextIdx]] = [reordered[nextIdx], reordered[idx]];
    const res = await fetch("/api/po/backlog/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: item.project_id,
        bucket: item.bucket,
        orderedIds: reordered.map((i) => i.id),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Không sắp xếp được backlog");
      return;
    }
    load();
  }
  function openCreate() {
    setModalItem(null);
    setShowModal(true);
  }
  function openEdit(item) {
    setModalItem(item);
    setShowModal(true);
  }
  function onSaved() {
    setShowModal(false);
    setModalItem(null);
    load();
  }

  const showProject = projectF === "Tất cả";
  // Nhóm theo bucket khi không lọc bucket — đúng cách PO nhìn backlog
  const grouped =
    bucketF === "Tất cả"
      ? BACKLOG_BUCKETS.map((b) => ({
          ...b,
          items: items.filter((i) => i.bucket === b.value),
        })).filter((g) => g.items.length > 0)
      : null;

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 className="page-title">📦 Backlog sản phẩm</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Thêm hạng mục
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Danh sách tính năng/hạng mục của sản phẩm — PO sắp thứ tự theo Làm ngay /
        Sắp tới / Để sau dựa trên giá trị.
      </p>

      {error && <div className="alert">{error}</div>}
      {notice && (
        <div
          className="alert"
          style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}
        >
          {notice.text}
          {notice.url && (
            <a
              href={notice.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 10, fontWeight: 600, color: "#166534" }}
            >
              Mở Notion ↗
            </a>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <input
          className="input"
          style={{ marginBottom: 14 }}
          placeholder="🔍 Tìm theo tiêu đề, user story, ghi chú..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="filter-bar">
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
            <span className="muted">Nhóm:</span>
            <select
              className="select"
              style={{ width: "auto" }}
              value={bucketF}
              onChange={(e) => setBucketF(e.target.value)}
            >
              <option>Tất cả</option>
              {BACKLOG_BUCKETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
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
              {BACKLOG_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="muted">{items.length} hạng mục</span>
      </div>

      {loading ? (
        <p className="muted">Đang tải...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 40, margin: 0 }}>📦</p>
          <p>
            Chưa có hạng mục nào. Bấm “+ Thêm hạng mục” và thử nút ✨ AI viết
            User story nhé!
          </p>
        </div>
      ) : grouped ? (
        grouped.map((g) => (
          <div key={g.value} style={{ marginBottom: 22 }}>
            <h2
              className="section-title"
              style={{ color: g.color, display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: g.color,
                  display: "inline-block",
                }}
              />
              {g.label}
              <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
                {g.items.length} hạng mục
              </span>
            </h2>
            {g.items.map((i) => (
              <BacklogCard
                key={i.id}
                item={i}
                showProject={showProject}
                onEdit={openEdit}
                onDelete={setDeleteItemTarget}
                onBucketChange={changeBucket}
                onStatusChange={changeStatus}
                onMove={moveItem}
                onExportNotion={exportNotion}
                canMoveUp={g.items.findIndex((x) => x.id === i.id) > 0}
                canMoveDown={g.items.findIndex((x) => x.id === i.id) < g.items.length - 1}
              />
            ))}
          </div>
        ))
      ) : (
        items.map((i) => (
          <BacklogCard
            key={i.id}
            item={i}
            showProject={showProject}
            onEdit={openEdit}
            onDelete={setDeleteItemTarget}
            onBucketChange={changeBucket}
            onStatusChange={changeStatus}
            onMove={moveItem}
            onExportNotion={exportNotion}
            canMoveUp={items.filter((x) => x.bucket === i.bucket).findIndex((x) => x.id === i.id) > 0}
            canMoveDown={items.filter((x) => x.bucket === i.bucket).findIndex((x) => x.id === i.id) < items.filter((x) => x.bucket === i.bucket).length - 1}
          />
        ))
      )}

      {showModal && (
        <BacklogModal
          projects={projects}
          defaultProjectId={projectF !== "Tất cả" ? Number(projectF) : undefined}
          item={modalItem}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        title="Xóa hạng mục backlog?"
        message={deleteItemTarget ? `Hạng mục "${deleteItemTarget.title}" sẽ bị xóa khỏi backlog.` : ""}
        confirmText="Xóa"
        danger
        onCancel={() => setDeleteItemTarget(null)}
        onConfirm={() => deleteItem(deleteItemTarget.id)}
      />
    </AppShell>
  );
}
