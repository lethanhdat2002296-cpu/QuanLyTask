"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  BACKLOG_BUCKETS,
  BACKLOG_STATUSES,
  BACKLOG_STATUS_COLORS,
  PHASE_STATUS_COLORS,
} from "@/lib/constants";

function StatCard({ icon, iconBg, num, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-num" style={{ color }}>
          {num}
        </div>
        <div className="stat-icon" style={{ background: iconBg }}>
          {icon}
        </div>
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Khối văn bản trong kết quả phân tích AI
function AnalysisText({ icon, title, text }) {
  if (!text) return null;
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {text}
      </div>
    </div>
  );
}

// Khối danh sách (điểm mạnh / rủi ro / đề xuất) trong kết quả phân tích AI
function AnalysisList({ icon, title, items, color, ordered }) {
  if (!items || items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color }}>
        {icon} {title}
      </div>
      <Tag style={{ margin: 0, paddingLeft: 22, fontSize: 14, lineHeight: 1.6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            {it}
          </li>
        ))}
      </Tag>
    </div>
  );
}

export default function PoDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectF, setProjectF] = useState("");
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzeErr, setAnalyzeErr] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/po/backlog"), fetch("/api/projects")])
      .then(async ([bRes, pRes]) => {
        if (bRes.status === 401 || pRes.status === 401) {
          router.replace("/login");
          return;
        }
        const b = await bRes.json();
        const p = await pRes.json();
        setItems(b.items || []);
        const ps = p.projects || [];
        setProjects(ps);
        if (ps[0]) setProjectF(String(ps[0].id));
      })
      .catch(() => setError("Không tải được số liệu"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Giai đoạn của dự án đang chọn
  useEffect(() => {
    if (!projectF) return;
    setAnalysis(null); // đổi dự án thì bỏ kết quả phân tích cũ
    setAnalyzeErr("");
    fetch(`/api/po/phases?project=${projectF}`)
      .then((r) => (r.ok ? r.json() : { phases: [] }))
      .then((d) => setPhases(d.phases || []))
      .catch(() => {});
  }, [projectF]);

  async function analyze() {
    if (!projectF) return;
    setAnalyzing(true);
    setAnalyzeErr("");
    setAnalysis(null);
    try {
      const res = await fetch("/api/po/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: Number(projectF) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalyzeErr(data.error || "Không phân tích được, thử lại sau.");
        return;
      }
      setAnalysis(data.analysis);
    } catch {
      setAnalyzeErr("Không phân tích được, thử lại sau.");
    } finally {
      setAnalyzing(false);
    }
  }

  const byBucket = Object.fromEntries(
    BACKLOG_BUCKETS.map((b) => [
      b.value,
      items.filter((i) => i.bucket === b.value).length,
    ])
  );
  const doneCount = items.filter((i) => i.status === "Hoàn thành").length;
  const byStatus = BACKLOG_STATUSES.map((s) => ({
    status: s,
    count: items.filter((i) => i.status === s).length,
  })).filter((x) => x.count > 0);
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));
  const runningPhases = phases.filter((ph) => ph.status === "Đang làm");
  const shownPhases = runningPhases.length > 0 ? runningPhases : phases;

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 22 }}>
        <h1 className="page-title">Tổng quan PO</h1>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/po/backlog")}
        >
          📦 Backlog sản phẩm
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted">Đang tải...</p>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard
              icon="📦"
              iconBg="#eef2ff"
              num={items.length}
              label="Tổng hạng mục backlog"
            />
            <StatCard
              icon="🔴"
              iconBg="#fef2f2"
              num={byBucket.now}
              label="Làm ngay (Now)"
              color={byBucket.now > 0 ? "#dc2626" : undefined}
            />
            <StatCard
              icon="🟠"
              iconBg="#fff7ed"
              num={byBucket.next}
              label="Sắp tới (Next)"
              color="#d97706"
            />
            <StatCard
              icon="✅"
              iconBg="#f0fdf4"
              num={doneCount}
              label={`Đã hoàn thành (Để sau: ${byBucket.later})`}
              color="#16a34a"
            />
          </div>

          <div
            className="card"
            style={{
              marginBottom: 20,
              border: "1px solid #c7d2fe",
              background: "#fafaff",
            }}
          >
            <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                🧭 AI đánh giá hướng sản phẩm
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {projects.length > 0 && (
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
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={analyze}
                  disabled={analyzing || !projectF}
                >
                  {analyzing ? "Đang phân tích..." : "Phân tích"}
                </button>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              AI cố vấn đọc backlog + giai đoạn + tài liệu của dự án rồi đánh giá
              hướng đi, sức khỏe, rủi ro và đề xuất 3 ưu tiên tiếp theo.
            </p>

            {analyzeErr && (
              <div className="alert" style={{ marginTop: 12 }}>
                {analyzeErr}
              </div>
            )}

            {analysis && (
              <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                <AnalysisText icon="🎯" title="Hướng đi" text={analysis.direction} />
                <AnalysisList
                  icon="💪"
                  title="Điểm mạnh"
                  items={analysis.strengths}
                  color="#16a34a"
                />
                <AnalysisText
                  icon="❤️"
                  title="Sức khỏe & tiến độ"
                  text={analysis.health}
                />
                <AnalysisText
                  icon="⚖️"
                  title="Cân đối backlog"
                  text={analysis.backlogBalance}
                />
                <AnalysisList
                  icon="⚠️"
                  title="Rủi ro"
                  items={analysis.risks}
                  color="#d97706"
                />
                <AnalysisList
                  icon="✅"
                  title="3 đề xuất ưu tiên tiếp theo"
                  items={analysis.recommendations}
                  color="#4f46e5"
                  ordered
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <div className="card">
              <h2 className="section-title">Hạng mục theo trạng thái</h2>
              {byStatus.length === 0 ? (
                <p className="muted">
                  Chưa có hạng mục nào — thêm ở trang Backlog sản phẩm.
                </p>
              ) : (
                <div className="chart">
                  {byStatus.map((s) => (
                    <div className="bar-row" key={s.status}>
                      <div className="bar-label">{s.status}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: (s.count / maxStatus) * 100 + "%",
                            background:
                              BACKLOG_STATUS_COLORS[s.status] || "#6b7280",
                          }}
                        />
                      </div>
                      <div className="bar-val">{s.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="row-between" style={{ marginBottom: 6 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  Giai đoạn{runningPhases.length > 0 ? " đang chạy" : ""}
                </h2>
                {projects.length > 0 && (
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
                )}
              </div>
              {shownPhases.length === 0 ? (
                <p className="muted">
                  Dự án này chưa có giai đoạn — tạo ở trang Giai đoạn phát
                  triển.
                </p>
              ) : (
                <div className="chart">
                  {shownPhases.map((ph) => {
                    const pct = ph.item_count
                      ? Math.round((ph.done_count / ph.item_count) * 100)
                      : 0;
                    return (
                      <div className="bar-row" key={ph.id}>
                        <div className="bar-label" title={ph.name}>
                          {ph.name}
                          <span
                            style={{
                              color:
                                PHASE_STATUS_COLORS[ph.status] || "#6b7280",
                              fontWeight: 700,
                            }}
                          >
                            {" "}
                            · {ph.status}
                          </span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: pct + "%",
                              background:
                                pct >= 100 ? "var(--success)" : "#4f46e5",
                            }}
                          />
                        </div>
                        <div className="bar-val">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}
          >
            <button className="btn" onClick={() => router.push("/po/backlog")}>
              📦 Backlog sản phẩm
            </button>
            <button className="btn" onClick={() => router.push("/po/phases")}>
              🗺️ Giai đoạn phát triển
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}
