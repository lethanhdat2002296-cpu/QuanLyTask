"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Menu theo chế độ làm việc: BA (phân tích nghiệp vụ) / PO (chủ sản phẩm)
const NAV_BA = [
  { href: "/", label: "Tổng quan", ico: "📊", exact: true },
  { href: "/projects", label: "Dự án", ico: "🗂️" },
  { href: "/my-tasks", label: "Công việc của tôi", ico: "✅" },
  { href: "/activity", label: "Lịch sử", ico: "🕒" },
];
const NAV_PO = [
  { href: "/po", label: "Tổng quan PO", ico: "📊", exact: true },
  { href: "/po/backlog", label: "Backlog sản phẩm", ico: "📦" },
  { href: "/po/matrix", label: "Ma trận ưu tiên", ico: "🎯" },
  { href: "/po/roadmap", label: "Roadmap", ico: "📅" },
  { href: "/po/phases", label: "Giai đoạn phát triển", ico: "🗺️" },
];

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user))
      .catch(() => {});
  }, []);

  // Đóng menu khi chuyển trang
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function go(href) {
    router.push(href);
    setNavOpen(false);
  }

  function isActive(item) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  // Chế độ làm việc suy ra từ URL (trang /po* = chế độ PO) — không lệch SSR/client.
  const mode = pathname.startsWith("/po") ? "po" : "ba";

  function switchMode(m) {
    if (m === mode) return;
    try {
      localStorage.setItem("workspaceMode", m); // nhớ cho lần đăng nhập sau
    } catch {}
    go(m === "po" ? "/po" : "/");
  }

  const items = [...(mode === "po" ? NAV_PO : NAV_BA)];
  if (me?.isAdmin) {
    items.push({ href: "/admin", label: "Quản trị", ico: "⚙️" });
  }

  return (
    <div className="shell">
      <aside className={"sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="sidebar-top">
          <div
            className="sidebar-brand"
            onClick={() => go(mode === "po" ? "/po" : "/")}
          >
            📋 <span>Quản Lý Task</span>
          </div>
          <button
            className="hamburger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Menu"
          >
            {navOpen ? "✕" : "☰"}
          </button>
        </div>
        <div className="mode-toggle" aria-label="Chế độ làm việc">
          <button
            className={"mode-btn" + (mode === "ba" ? " active" : "")}
            onClick={() => switchMode("ba")}
            title="Chế độ Business Analyst: dự án, task khách hàng"
          >
            🧩 BA
          </button>
          <button
            className={"mode-btn" + (mode === "po" ? " active" : "")}
            onClick={() => switchMode("po")}
            title="Chế độ Product Owner: backlog, giai đoạn phát triển"
          >
            🎯 PO
          </button>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <button
              key={item.href}
              className={"sidebar-link" + (isActive(item) ? " active" : "")}
              onClick={() => go(item.href)}
            >
              <span className="ico">{item.ico}</span>
              <span className="label-text">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {me && (
            <div className="sidebar-user">
              <span>👤 {me.username}</span>
              {me.isAdmin && (
                <span className="badge" style={{ background: "#7c3aed" }}>
                  Admin
                </span>
              )}
            </div>
          )}
          <button
            className="sidebar-link"
            onClick={logout}
            style={{ color: "#fca5a5" }}
          >
            <span className="ico">🚪</span>
            <span className="label-text">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
