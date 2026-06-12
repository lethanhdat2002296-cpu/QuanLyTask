"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { PHASE_STATUS_COLORS } from "@/lib/constants";

const ROW_H = 36;
const MONTHS_VN = ["Th1","Th2","Th3","Th4","Th5","Th6","Th7","Th8","Th9","Th10","Th11","Th12"];
const DAY = 86400000;

function parseD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
const days = (a, b) => Math.round((b - a) / DAY);

function fmtD(ms) {
  const d = new Date(ms);
  return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
}

export default function RoadmapPage() {
  const router = useRouter();
  const [phases, setPhases] = useState([]);
  const [projectF, setProjectF] = useState("Tất cả");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // 1 request duy nhất lấy giai đoạn của mọi dự án (tránh N+1 theo dự án)
    fetch("/api/po/phases?all=1")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.ok ? r.json() : { phases: [] };
      })
      .then((d) => d && setPhases(d.phases || []))
      .catch(() => setError("Không tải được roadmap"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nhóm theo dự án (đã lọc), giữ thứ tự API trả về
  const groups = useMemo(() => {
    const list = phases.filter(
      (ph) => projectF === "Tất cả" || String(ph.project_id) === projectF
    );
    const byProject = new Map();
    for (const ph of list) {
      if (!byProject.has(ph.project_id)) {
        byProject.set(ph.project_id, {
          id: ph.project_id,
          name: ph.project_name,
          phases: [],
        });
      }
      byProject.get(ph.project_id).phases.push(ph);
    }
    return [...byProject.values()];
  }, [phases, projectF]);

  const projects = useMemo(() => {
    const seen = new Map();
    for (const ph of phases) {
      if (!seen.has(ph.project_id)) seen.set(ph.project_id, ph.project_name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [phases]);

  // ===== Trục thời gian =====
  // - Mốc tháng đặt theo NGÀY THẬT của từng tháng (28-31 ngày) — không lệch.
  // - Tỷ lệ px/ngày TỰ ĐỘNG để dữ liệu lấp đầy ~900px (kẹp 2..14 px/ngày):
  //   khoảng thời gian ngắn được phóng to, dài thì thu nhỏ — không dồn cụm.
  const today = (() => {
    const n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  })();

  const tl = useMemo(() => {
    const stamps = [];
    for (const g of groups)
      for (const ph of g.phases) {
        const s = parseD(ph.start_date);
        if (s == null) continue;
        stamps.push(s);
        const e = parseD(ph.end_date);
        stamps.push(e != null ? Math.max(e, s) : s);
      }
    if (stamps.length === 0) return null;
    let minD = Math.min(...stamps);
    let maxD = Math.max(...stamps);
    // đưa "hôm nay" vào khung nhìn nếu gần dữ liệu (±60 ngày)
    if (Math.abs(days(minD, today)) <= 60 || Math.abs(days(maxD, today)) <= 60) {
      minD = Math.min(minD, today);
      maxD = Math.max(maxD, today);
    }
    const o = new Date(minD);
    const origin = Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), 1);
    const e = new Date(maxD);
    const endMonth = Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 1);
    const totalDays = Math.max(days(origin, endMonth), 7);
    const pxPerDay = Math.min(14, Math.max(2, 900 / totalDays));
    const width = totalDays * pxPerDay;

    const months = [];
    let cur = origin;
    while (cur < endMonth) {
      const d = new Date(cur);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      months.push({
        left: days(origin, cur) * pxPerDay,
        width: days(cur, next) * pxPerDay,
        label: MONTHS_VN[d.getUTCMonth()] + "/" + String(d.getUTCFullYear()).slice(2),
      });
      cur = next;
    }
    const todayX =
      today >= origin && today <= endMonth ? days(origin, today) * pxPerDay : null;
    return { origin, width, months, pxPerDay, todayX };
  }, [groups, today]);

  function barOf(ph) {
    if (!tl) return null;
    const s = parseD(ph.start_date);
    if (s == null) return null;
    const e = parseD(ph.end_date);
    const left = days(tl.origin, s) * tl.pxPerDay;
    // end inclusive: giai đoạn 1 ngày = đúng 1 ô ngày; không có end -> bar mở (vẽ kiểu nét đứt)
    const widthDays = e != null ? days(s, e) + 1 : 1;
    const width = Math.max(widthDays * tl.pxPerDay, 6);
    return { left, width, openEnd: e == null };
  }

  const unscheduled = groups
    .map((g) => ({
      ...g,
      phases: g.phases.filter((ph) => parseD(ph.start_date) == null),
    }))
    .filter((g) => g.phases.length > 0);

  return (
    <AppShell>
      <h1 className="page-title" style={{ marginBottom: 6 }}>
        📅 Roadmap sản phẩm
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Các giai đoạn trên cùng một trục thời gian — độ dài thanh đúng theo số
        ngày, kèm mốc “Hôm nay”. Giai đoạn chưa đặt ngày nằm ở mục “Chưa xếp
        lịch”.
      </p>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 18, width: "40%" }} />
          <div className="skeleton" style={{ height: 90, marginTop: 12 }} />
          <div className="skeleton" style={{ height: 90, marginTop: 12 }} />
        </div>
      ) : phases.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 40, margin: 0 }}>📅</p>
          <p>Chưa có giai đoạn nào. Tạo ở trang “Giai đoạn phát triển”.</p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/po/phases")}
          >
            + Tạo giai đoạn đầu tiên
          </button>
        </div>
      ) : (
        <>
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
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {tl ? (
            <div className="card" style={{ overflowX: "auto" }}>
              <div
                style={{
                  position: "relative",
                  width: tl.width,
                  minWidth: "100%",
                  paddingTop: 24,
                }}
              >
                {/* Nhãn tháng + kẻ dọc đặt theo ngày THẬT của từng tháng */}
                {tl.months.map((m, i) => (
                  <div key={i}>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: m.left,
                        fontSize: 11,
                        color: "#64748b",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 20,
                        bottom: 0,
                        left: m.left,
                        width: 1,
                        background: "#eef1f6",
                      }}
                    />
                  </div>
                ))}

                {/* Mốc HÔM NAY */}
                {tl.todayX != null && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: 20,
                        bottom: 0,
                        left: tl.todayX,
                        width: 2,
                        background: "#dc2626",
                        zIndex: 2,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: tl.todayX + 4,
                        fontSize: 10,
                        color: "#dc2626",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Hôm nay
                    </div>
                  </>
                )}

                {groups.map((g) => {
                  const dated = g.phases.filter(
                    (ph) => parseD(ph.start_date) != null
                  );
                  if (dated.length === 0) return null;
                  return (
                    <div
                      key={g.id}
                      style={{ marginBottom: 16, position: "relative" }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          margin: "6px 0 4px",
                          position: "sticky",
                          left: 0,
                        }}
                      >
                        🗂️ {g.name}
                      </div>
                      <div
                        style={{
                          position: "relative",
                          height: dated.length * ROW_H,
                        }}
                      >
                        {dated.map((ph, ri) => {
                          const b = barOf(ph);
                          const color =
                            PHASE_STATUS_COLORS[ph.status] || "#6b7280";
                          const pct = ph.total_effort
                            ? Math.round((ph.done_effort / ph.total_effort) * 100)
                            : 0;
                          const s = parseD(ph.start_date);
                          const e = parseD(ph.end_date);
                          const tip =
                            `${ph.name} · ${ph.status}` +
                            (s != null
                              ? ` · ${fmtD(s)} → ${e != null ? fmtD(e) : "?"}`
                              : "") +
                            ` · tiến độ ${pct}% (${ph.done_count}/${ph.item_count} hạng mục)` +
                            (ph.is_overdue ? " · TRỄ HẠN" : "");
                          return (
                            <div
                              key={ph.id}
                              title={tip}
                              style={{
                                position: "absolute",
                                top: ri * ROW_H + 4,
                                left: b.left,
                                width: b.width,
                                height: ROW_H - 10,
                                background: color,
                                borderRadius: 6,
                                overflow: "hidden",
                                border: ph.is_overdue
                                  ? "2px solid #dc2626"
                                  : "none",
                                outline: b.openEnd
                                  ? "2px dashed " + color
                                  : "none",
                                outlineOffset: 2,
                                zIndex: 1,
                              }}
                            >
                              {/* lớp tiến độ (đậm hơn) bên trong bar */}
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: pct + "%",
                                  background: "rgba(255,255,255,0.32)",
                                }}
                              />
                              <span
                                style={{
                                  position: "relative",
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  lineHeight: ROW_H - 10 + "px",
                                  padding: "0 8px",
                                  whiteSpace: "nowrap",
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {ph.name}
                                {b.openEnd ? " →" : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chú thích */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                {Object.keys(PHASE_STATUS_COLORS).map((s) => (
                  <span
                    key={s}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 10,
                        borderRadius: 3,
                        background: PHASE_STATUS_COLORS[s],
                        display: "inline-block",
                      }}
                    />
                    {s}
                  </span>
                ))}
                <span
                  className="muted"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 10,
                      borderRadius: 3,
                      border: "2px solid #dc2626",
                      display: "inline-block",
                    }}
                  />
                  viền đỏ = trễ hạn
                </span>
                <span
                  className="muted"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 10,
                      borderRadius: 3,
                      border: "2px dashed #94a3b8",
                      display: "inline-block",
                    }}
                  />
                  nét đứt = chưa có ngày kết thúc
                </span>
                <span className="muted">
                  phần sáng trong thanh = % tiến độ theo công sức
                </span>
              </div>
            </div>
          ) : (
            <div
              className="alert"
              style={{ background: "#eff6ff", color: "#1e3a8a" }}
            >
              Chưa giai đoạn nào có ngày bắt đầu — hãy đặt ngày để xếp lên trục
              thời gian.
            </div>
          )}

          {unscheduled.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 className="section-title">🕗 Chưa xếp lịch (chưa đặt ngày)</h2>
              {unscheduled.map((g) => (
                <div key={g.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    🗂️ {g.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    {g.phases.map((ph) => (
                      <span
                        key={ph.id}
                        className="pill"
                        style={{
                          borderLeft: `3px solid ${
                            PHASE_STATUS_COLORS[ph.status] || "#6b7280"
                          }`,
                        }}
                      >
                        {ph.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
