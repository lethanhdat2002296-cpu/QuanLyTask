"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";
import { STATUS_COLORS } from "@/lib/constants";

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

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setStats(d))
      .catch(() => setError("Không tải được số liệu"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxStatus = stats
    ? Math.max(1, ...stats.byStatus.map((s) => s.count))
    : 1;

  return (
    <AppShell>
      <div className="row-between" style={{ marginBottom: 22 }}>
        <h1 className="page-title">Tổng quan</h1>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/my-tasks")}
        >
          ✅ Công việc của tôi
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading || !stats ? (
        <Skeleton />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard
              icon="📋"
              iconBg="#eef2ff"
              num={stats.total}
              label="Tổng số task"
            />
            <StatCard
              icon="⏳"
              iconBg="#fff7ed"
              num={stats.open}
              label="Chưa hoàn thành"
              color="#d97706"
            />
            <StatCard
              icon="🔴"
              iconBg="#fef2f2"
              num={stats.overdue}
              label="Đang quá hạn"
              color={stats.overdue > 0 ? "#dc2626" : undefined}
            />
            <StatCard
              icon="✅"
              iconBg="#f0fdf4"
              num={stats.completedThisMonth}
              label={`Hoàn thành tháng này (tuần này: ${stats.completedThisWeek})`}
              color="#16a34a"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <div className="card">
              <h2 className="section-title">Task theo trạng thái</h2>
              {stats.byStatus.length === 0 ? (
                <p className="muted">Chưa có task nào.</p>
              ) : (
                <div className="chart">
                  {stats.byStatus.map((s) => (
                    <div className="bar-row" key={s.status}>
                      <div className="bar-label">{s.status}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: (s.count / maxStatus) * 100 + "%",
                            background: STATUS_COLORS[s.status] || "#6b7280",
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
              <h2 className="section-title">Tiến độ theo dự án</h2>
              {stats.byProject.length === 0 ? (
                <p className="muted">Chưa có dự án nào.</p>
              ) : (
                <div className="chart">
                  {stats.byProject.map((p, i) => {
                    const pct = p.total
                      ? Math.round((p.done / p.total) * 100)
                      : 0;
                    return (
                      <div className="bar-row" key={i}>
                        <div className="bar-label" title={p.name}>
                          {p.name}
                          {p.overdue > 0 && (
                            <span
                              style={{ color: "#dc2626", fontWeight: 700 }}
                            >
                              {" "}
                              · {p.overdue} quá hạn
                            </span>
                          )}
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: pct + "%",
                              background: "var(--success)",
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

          <div className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title">📤 Xuất báo cáo (CSV cho Excel)</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Tải danh sách task đã hoàn thành theo kỳ — mở bằng Excel/Google Sheets.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn" href="/api/reports?period=week">
                ⬇ Hoàn thành tuần này
              </a>
              <a className="btn" href="/api/reports?period=month">
                ⬇ Hoàn thành tháng này
              </a>
              <a className="btn" href="/api/reports?period=all">
                ⬇ Tất cả task
              </a>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => router.push("/projects")}>
              🗂️ Xem dự án
            </button>
            <button className="btn" onClick={() => router.push("/activity")}>
              🕒 Lịch sử hoạt động
            </button>
            {stats.overdue > 0 && (
              <button
                className="btn btn-danger"
                onClick={() => router.push("/my-tasks?overdue=1")}
              >
                🔴 Xem {stats.overdue} task quá hạn
              </button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
