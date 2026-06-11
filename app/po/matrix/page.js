"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import BacklogModal from "@/components/BacklogModal";
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  VALUE_LABELS,
  EFFORT_LABELS,
} from "@/lib/constants";

// Khung vẽ
const PX0 = 78, PX1 = 432, PY0 = 26, PY1 = 326;
const COLW = (PX1 - PX0) / 3;
const ROWH = (PY1 - PY0) / 3;

function clamp123(v) {
  const n = Number(v);
  return [1, 2, 3].includes(n) ? n : 2;
}

export default function MatrixPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectF, setProjectF] = useState("Tất cả");
  const [hideDone, setHideDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalItem, setModalItem] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (projectF !== "Tất cả") p.set("project", projectF);
      const res = await fetch("/api/po/backlog?" + p.toString());
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

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectF]);

  function onSaved() {
    setShowModal(false);
    setModalItem(null);
    load();
  }

  // Tính vị trí từng điểm: nhóm theo ô (effort × value) rồi xếp lưới nhỏ trong ô
  const dots = useMemo(() => {
    const shown = items.filter((i) => !hideDone || i.status !== "Hoàn thành");
    const byCell = {};
    for (const it of shown) {
      const e = clamp123(it.effort); // 1 Nhỏ .. 3 Lớn  -> cột (trái sang phải)
      const v = clamp123(it.business_value); // 1 Cao .. 3 Thấp -> hàng (trên xuống)
      const key = e + "-" + v;
      (byCell[key] = byCell[key] || []).push(it);
    }
    const out = [];
    for (const key of Object.keys(byCell)) {
      const [e, v] = key.split("-").map(Number);
      const cx = PX0 + (e - 0.5) * COLW;
      const cy = PY0 + (v - 0.5) * ROWH;
      const group = byCell[key];
      const per = Math.ceil(Math.sqrt(group.length));
      const gap = 20;
      group.forEach((it, idx) => {
        const r = Math.floor(idx / per);
        const c = idx % per;
        const rows = Math.ceil(group.length / per);
        const x = cx + (c - (per - 1) / 2) * gap;
        const y = cy + (r - (rows - 1) / 2) * gap;
        out.push({ it, x, y });
      });
    }
    return out;
  }, [items, hideDone]);

  const showProject = projectF === "Tất cả";

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 className="page-title">🎯 Ma trận ưu tiên (Giá trị × Công sức)</h1>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Mỗi hạng mục backlog là một điểm. Góc trên-trái (giá trị cao + công sức
        nhỏ) là “nên làm ngay”. Bấm vào điểm để mở hạng mục.
      </p>

      {error && <div className="alert">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
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
          <label className="filter-item" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
            <span>Ẩn hạng mục đã hoàn thành</span>
          </label>
        </div>
      </div>

      {loading ? (
        <p className="muted">Đang tải...</p>
      ) : dots.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 40, margin: 0 }}>🎯</p>
          <p>Chưa có hạng mục nào để xếp lên ma trận.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <svg
            viewBox="0 0 460 392"
            style={{ width: "100%", minWidth: 420, maxWidth: 620 }}
            role="img"
            aria-label="Ma trận giá trị và công sức của các hạng mục backlog"
          >
            {/* Ô 'nên làm ngay': giá trị cao (hàng 1) + công sức nhỏ (cột 1) */}
            <rect
              x={PX0}
              y={PY0}
              width={COLW}
              height={ROWH}
              fill="#16a34a"
              opacity="0.10"
            />
            <text
              x={PX0 + COLW / 2}
              y={PY0 + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#16a34a"
              fontWeight="700"
            >
              Nên làm ngay
            </text>

            {/* Lưới 3x3 */}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={"v" + i}
                x1={PX0 + i * COLW}
                y1={PY0}
                x2={PX0 + i * COLW}
                y2={PY1}
                stroke="#e5e9f2"
              />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={"h" + i}
                x1={PX0}
                y1={PY0 + i * ROWH}
                x2={PX1}
                y2={PY0 + i * ROWH}
                stroke="#e5e9f2"
              />
            ))}

            {/* Nhãn trục Y (Giá trị): Cao trên cùng */}
            <text x={20} y={(PY0 + PY1) / 2} fontSize="12" fontWeight="700" fill="#475569" transform={`rotate(-90 20 ${(PY0 + PY1) / 2})`} textAnchor="middle">
              Giá trị →
            </text>
            {[1, 2, 3].map((v) => (
              <text
                key={"yl" + v}
                x={PX0 - 8}
                y={PY0 + (v - 0.5) * ROWH + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {VALUE_LABELS[v]}
              </text>
            ))}

            {/* Nhãn trục X (Công sức) */}
            <text x={(PX0 + PX1) / 2} y={PY1 + 34} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
              Công sức →
            </text>
            {[1, 2, 3].map((e) => (
              <text
                key={"xl" + e}
                x={PX0 + (e - 0.5) * COLW}
                y={PY1 + 16}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {EFFORT_LABELS[e]}
              </text>
            ))}

            {/* Các điểm */}
            {dots.map(({ it, x, y }) => {
              const done = it.status === "Hoàn thành";
              const color = BUCKET_COLORS[it.bucket] || "#475569";
              return (
                <g
                  key={it.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setModalItem(it);
                    setShowModal(true);
                  }}
                >
                  <title>
                    {it.title} — {VALUE_LABELS[it.business_value]} giá trị /{" "}
                    {EFFORT_LABELS[it.effort]} công sức · {BUCKET_LABELS[it.bucket]}
                    {done ? " · Hoàn thành" : ""}
                  </title>
                  <circle
                    cx={x}
                    cy={y}
                    r="9"
                    fill={done ? "#fff" : color}
                    stroke={color}
                    strokeWidth="2"
                    opacity={done ? 0.85 : 1}
                  />
                  {done && (
                    <text
                      x={x}
                      y={y + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fill={color}
                      fontWeight="700"
                    >
                      ✓
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Chú thích màu theo nhóm */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 10,
              fontSize: 13,
            }}
          >
            {Object.keys(BUCKET_LABELS).map((b) => (
              <span
                key={b}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: BUCKET_COLORS[b],
                    display: "inline-block",
                  }}
                />
                {BUCKET_LABELS[b]}
              </span>
            ))}
            <span style={{ display: "flex", alignItems: "center", gap: 6 }} className="muted">
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "#fff",
                  border: "2px solid #94a3b8",
                  display: "inline-block",
                }}
              />
              ✓ = đã hoàn thành
            </span>
          </div>
        </div>
      )}

      {showModal && (
        <BacklogModal
          projects={projects}
          item={modalItem}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </AppShell>
  );
}
