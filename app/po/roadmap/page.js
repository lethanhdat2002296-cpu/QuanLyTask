"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { PHASE_STATUS_COLORS } from "@/lib/constants";

const PX_PER_DAY = 3.2; // ~96px mỗi tháng
const ROW_H = 34;
const MIN_BAR = 46;

function parseD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
const DAY = 86400000;
const days = (a, b) => Math.round((b - a) / DAY);
const MONTHS_VN = ["Th1","Th2","Th3","Th4","Th5","Th6","Th7","Th8","Th9","Th10","Th11","Th12"];

export default function RoadmapPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]); // [{ project, phases }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const pr = await fetch("/api/projects");
        if (pr.status === 401) {
          router.replace("/login");
          return;
        }
        const { projects = [] } = await pr.json();
        const phaseLists = await Promise.all(
          projects.map((p) =>
            fetch(`/api/po/phases?project=${p.id}`)
              .then((r) => (r.ok ? r.json() : { phases: [] }))
              .then((d) => d.phases || [])
              .catch(() => [])
          )
        );
        setGroups(
          projects
            .map((p, i) => ({ project: p, phases: phaseLists[i] }))
            .filter((g) => g.phases.length > 0)
        );
      } catch {
        setError("Không tải được roadmap");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tính trục thời gian từ các giai đoạn CÓ ngày bắt đầu
  const tl = useMemo(() => {
    const dated = [];
    for (const g of groups)
      for (const ph of g.phases) {
        const s = parseD(ph.start_date);
        if (s == null) continue;
        const e = parseD(ph.end_date) ?? s;
        dated.push(Math.max(e, s));
        dated.push(s);
      }
    if (dated.length === 0) return null;
    const minD = Math.min(...dated);
    const maxD = Math.max(...dated);
    // gốc = ngày 1 của tháng nhỏ nhất
    const od = new Date(minD);
    const origin = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), 1);
    const ed = new Date(maxD);
    const endMonth = Date.UTC(ed.getUTCFullYear(), ed.getUTCMonth() + 1, 1); // hết tháng lớn nhất
    const totalDays = days(origin, endMonth) + 4;
    const width = Math.max(totalDays * PX_PER_DAY, 320);
    // các mốc tháng
    const months = [];
    let cur = origin;
    while (cur < endMonth) {
      const d = new Date(cur);
      months.push({
        left: days(origin, cur) * PX_PER_DAY,
        label: MONTHS_VN[d.getUTCMonth()] + "/" + String(d.getUTCFullYear()).slice(2),
      });
      cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    return { origin, width, months };
  }, [groups]);

  function barOf(ph) {
    const s = parseD(ph.start_date);
    if (s == null || !tl) return null;
    const e = parseD(ph.end_date) ?? s;
    const left = days(tl.origin, s) * PX_PER_DAY;
    const width = Math.max(MIN_BAR, days(s, e) * PX_PER_DAY);
    return { left, width };
  }

  const unscheduled = groups
    .map((g) => ({
      project: g.project,
      phases: g.phases.filter((ph) => parseD(ph.start_date) == null),
    }))
    .filter((g) => g.phases.length > 0);

  return (
    <AppShell>
      <h1 className="page-title" style={{ marginBottom: 6 }}>
        📅 Roadmap sản phẩm
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Các giai đoạn của mọi dự án trên cùng một trục thời gian. Giai đoạn chưa
        đặt ngày được gom xuống “Chưa xếp lịch”.
      </p>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted">Đang tải...</p>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 40, margin: 0 }}>📅</p>
          <p>Chưa có giai đoạn nào. Tạo giai đoạn ở trang “Giai đoạn phát triển”.</p>
        </div>
      ) : (
        <>
          {tl ? (
            <div className="card" style={{ overflowX: "auto" }}>
              <div style={{ position: "relative", width: tl.width, minWidth: "100%" }}>
                {/* Header tháng + đường kẻ dọc */}
                <div style={{ position: "relative", height: 22, marginBottom: 6 }}>
                  {tl.months.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: m.left,
                        fontSize: 11,
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {groups.map((g) => {
                  const dated = g.phases.filter((ph) => parseD(ph.start_date) != null);
                  if (dated.length === 0) return null;
                  return (
                    <div key={g.project.id} style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        🗂️ {g.project.name}
                      </div>
                      <div
                        style={{
                          position: "relative",
                          height: dated.length * ROW_H,
                          background:
                            "repeating-linear-gradient(90deg, transparent, transparent " +
                            (PX_PER_DAY * 30 - 1) +
                            "px, #eef1f6 " +
                            (PX_PER_DAY * 30 - 1) +
                            "px, #eef1f6 " +
                            PX_PER_DAY * 30 +
                            "px)",
                          borderRadius: 8,
                        }}
                      >
                        {dated.map((ph, ri) => {
                          const b = barOf(ph);
                          const color = PHASE_STATUS_COLORS[ph.status] || "#6b7280";
                          return (
                            <div
                              key={ph.id}
                              title={`${ph.name} · ${ph.status}`}
                              style={{
                                position: "absolute",
                                top: ri * ROW_H + 4,
                                left: b.left,
                                width: b.width,
                                height: ROW_H - 10,
                                background: color,
                                color: "#fff",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                lineHeight: (ROW_H - 10) + "px",
                                padding: "0 8px",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                opacity: ph.is_overdue ? 1 : 0.92,
                                border: ph.is_overdue ? "2px solid #dc2626" : "none",
                              }}
                            >
                              {ph.name}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="alert" style={{ background: "#eff6ff", color: "#1e3a8a" }}>
              Chưa giai đoạn nào có ngày bắt đầu — hãy đặt ngày để xếp lên trục
              thời gian. Bên dưới là các giai đoạn chưa xếp lịch.
            </div>
          )}

          {/* Chú thích trạng thái */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "12px 0", fontSize: 13 }}>
            {Object.keys(PHASE_STATUS_COLORS).map((s) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, background: PHASE_STATUS_COLORS[s], display: "inline-block" }} />
                {s}
              </span>
            ))}
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 10, borderRadius: 3, border: "2px solid #dc2626", display: "inline-block" }} />
              viền đỏ = trễ hạn
            </span>
          </div>

          {unscheduled.length > 0 && (
            <div className="card">
              <h2 className="section-title">🕗 Chưa xếp lịch (chưa đặt ngày)</h2>
              {unscheduled.map((g) => (
                <div key={g.project.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>🗂️ {g.project.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {g.phases.map((ph) => (
                      <span
                        key={ph.id}
                        className="pill"
                        style={{ borderLeft: `3px solid ${PHASE_STATUS_COLORS[ph.status] || "#6b7280"}` }}
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
