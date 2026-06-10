"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div
          className="brand"
          style={{ cursor: "pointer" }}
          onClick={() => router.push("/")}
        >
          📋 Quản Lý Task
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {me && (
            <span className="muted" style={{ fontSize: 13 }}>
              {me.username}
              {me.isAdmin && (
                <span
                  className="badge"
                  style={{ background: "#7c3aed", marginLeft: 6 }}
                >
                  Admin
                </span>
              )}
            </span>
          )}
          {me && (
            <button
              className="btn btn-sm"
              onClick={() => router.push("/my-tasks")}
            >
              Công việc của tôi
            </button>
          )}
          {me && (
            <button
              className="btn btn-sm"
              onClick={() => router.push("/activity")}
            >
              Lịch sử
            </button>
          )}
          {me?.isAdmin && (
            <button className="btn btn-sm" onClick={() => router.push("/admin")}>
              Quản trị
            </button>
          )}
          <button className="btn btn-sm" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
