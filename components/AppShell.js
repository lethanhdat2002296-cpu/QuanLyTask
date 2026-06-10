"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Tổng quan", ico: "📊", exact: true },
  { href: "/projects", label: "Dự án", ico: "🗂️" },
  { href: "/my-tasks", label: "Công việc của tôi", ico: "✅" },
  { href: "/activity", label: "Lịch sử", ico: "🕒" },
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

  const items = [...NAV];
  if (me?.isAdmin) {
    items.push({ href: "/admin", label: "Quản trị", ico: "⚙️" });
  }

  return (
    <div className="shell">
      <aside className={"sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="sidebar-top">
          <div className="sidebar-brand" onClick={() => go("/")}>
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
