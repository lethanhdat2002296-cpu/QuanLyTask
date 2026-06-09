"use client";

import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();

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
        <button className="btn btn-sm" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
