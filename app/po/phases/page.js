"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";
import PhaseModal from "@/components/PhaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PHASE_STATUSES, PHASE_STATUS_COLORS } from "@/lib/constants";
import { fetchProjectsCached } from "@/lib/clientCache";

function fmtDate(v) {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("vi-VN");
}

export default function PhasesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [projectF, setProjectF] = useState("");
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalPhase, setModalPhase] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deletePhaseTarget, setDeletePhaseTarget] = useState(null);

  useEffect(() => {
    fetchProjectsCached()
      .then((d) => {
        const ps = d.projects || [];
        setProjects(ps);
        if (ps[0]) setProjectF(String(ps[0].id));
        else setLoading(false);
      })
      .catch(() => {
        setError("Không tải được dự án");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!projectF) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/po/phases?project=${projectF}`);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setPhases(data.phases || []);
    } catch {
      setError("Không tải được giai đoạn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectF]);

  async function changeStatus(id, status) {
    await fetch(`/api/po/phases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }
  async function deletePhase(id) {
    await fetch(`/api/po/phases/${id}`, { method: "DELETE" });
    setDeletePhaseTarget(null);
    load();
  }
  function openCreate() {
    setModalPhase(null);
    setShowModal(true);
  }
  function openEdit(phase) {
    setModalPhase(phase);
    setShowModal(true);
  }
  function onSaved() {
    setShowModal(false);
    setModalPhase(null);
    load();
  }

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 className="page-title">🗺️ Giai đoạn phát triển</h1>
        <button
          className="btn btn-primary"
          onClick={openCreate}
          disabled={!projectF}
        >
          + Thêm giai đoạn
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Lộ trình phát triển của từng phần mềm — mỗi giai đoạn có mục tiêu, thời
        gian và tiến độ tính theo hạng mục backlog đã hoàn thành.
      </p>

      {error && <div className="alert">{error}</div>}

      {projects.length === 0 && !loading ? (
        <div className="empty-state">
          <p style={{ fontSize: 40, margin: 0 }}>🗂️</p>
          <p>
            Chưa có dự án nào. Hãy chuyển sang chế độ BA để tạo dự án trước.
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="filter-bar">
              <div className="filter-item">
                <span className="muted">Dự án / sản phẩm:</span>
                <select
                  className="select"
                  style={{ width: "auto" }}
                  value={projectF}
                  onChange={(e) => setProjectF(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <Skeleton />
          ) : phases.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: 40, margin: 0 }}>🗺️</p>
              <p>
                Chưa có giai đoạn nào — tạo “GĐ1 — MVP” để bắt đầu lộ trình
                sản phẩm!
              </p>
            </div>
          ) : (
            phases.map((ph, idx) => {
              // Tiến độ tính theo CÔNG SỨC (effort), không chỉ đếm số lượng hạng mục
              const pct = ph.total_effort
                ? Math.round((ph.done_effort / ph.total_effort) * 100)
                : 0;
              return (
                <div className="card" key={ph.id} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#4f46e5",
                        fontSize: 13,
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
                      {ph.name}
                    </h2>
                    {ph.is_overdue && (
                      <span className="badge badge-overdue">Trễ hạn</span>
                    )}
                    <span
                      className="badge"
                      style={{
                        background: PHASE_STATUS_COLORS[ph.status] || "#6b7280",
                      }}
                    >
                      {ph.status}
                    </span>
                  </div>

                  <div className="task-meta" style={{ marginTop: 8 }}>
                    {(ph.start_date || ph.end_date) && (
                      <span className="pill">
                        🗓️ {fmtDate(ph.start_date) || "?"} →{" "}
                        {fmtDate(ph.end_date) || "?"}
                      </span>
                    )}
                    <span className="pill">
                      📦 {ph.item_count} hạng mục · ✅ {ph.done_count} xong
                    </span>
                    <span className="pill">
                      ⚖️ Công sức: {ph.done_effort}/{ph.total_effort}
                    </span>
                  </div>

                  {ph.goal && (
                    <p style={{ margin: "10px 0 4px", whiteSpace: "pre-wrap" }}>
                      🎯 {ph.goal}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <div className="bar-track" style={{ flex: 1 }}>
                      <div
                        className="bar-fill"
                        style={{
                          width: pct + "%",
                          background:
                            pct >= 100 ? "var(--success)" : "#4f46e5",
                        }}
                      />
                    </div>
                    <span className="muted" style={{ fontSize: 13, width: 42 }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Tiến độ tính theo công sức (hạng mục lớn nặng hơn hạng mục
                    nhỏ)
                  </div>

                  <div className="task-actions" style={{ marginTop: 12 }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Trạng thái:
                    </span>
                    <select
                      className="select"
                      style={{ width: "auto" }}
                      value={ph.status}
                      onChange={(e) => changeStatus(ph.id, e.target.value)}
                    >
                      {PHASE_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-sm" onClick={() => openEdit(ph)}>
                      Sửa
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeletePhaseTarget(ph)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {showModal && (
        <PhaseModal
          projectId={Number(projectF)}
          phase={modalPhase}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
      <ConfirmDialog
        open={Boolean(deletePhaseTarget)}
        title="Xóa giai đoạn?"
        message={
          deletePhaseTarget
            ? `Giai đoạn "${deletePhaseTarget.name}" sẽ bị xóa. Hạng mục backlog đang gắn vào sẽ tự bỏ gắn.`
            : ""
        }
        confirmText="Xóa"
        danger
        onCancel={() => setDeletePhaseTarget(null)}
        onConfirm={() => deletePhase(deletePhaseTarget.id)}
      />
    </AppShell>
  );
}
