"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      // Ưu tiên quay lại trang đang xem dở (?next=...), nếu không thì
      // vào đúng chế độ làm việc đã chọn lần trước (BA hoặc PO).
      let dest = "/";
      try {
        const next = new URLSearchParams(window.location.search).get("next");
        // chỉ nhận đường dẫn nội bộ ("/..." nhưng không phải "//host" mạo danh)
        if (next && next.startsWith("/") && !next.startsWith("//")) {
          dest = next;
        } else if (localStorage.getItem("workspaceMode") === "po") {
          dest = "/po";
        }
      } catch {}
      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError("Không kết nối được máy chủ");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>📋 Quản Lý Task</h1>
        <p className="sub">
          Quản lý task khách hàng (BA) · Backlog &amp; Roadmap sản phẩm (PO)
        </p>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Tên đăng nhập</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 6 }}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <div className="auth-links">
          <Link className="link" href="/forgot-password">
            Quên mật khẩu?
          </Link>
          <span>
            Chưa có tài khoản?{" "}
            <Link className="link" href="/register">
              Đăng ký
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
