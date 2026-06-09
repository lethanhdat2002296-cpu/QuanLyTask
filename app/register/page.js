"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng ký thất bại");
        setLoading(false);
        return;
      }
      // Đăng ký xong tự đăng nhập -> về trang chính
      router.replace("/");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>📋 Đăng ký tài khoản</h1>
        <p className="sub">Tạo tài khoản mới để dùng Quản Lý Task</p>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Tên đăng nhập</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="Tối thiểu 3 ký tự"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
              placeholder="Dùng để lấy lại mật khẩu khi quên"
            />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>
          <div className="field">
            <label>Mã mời</label>
            <input
              className="input"
              value={form.inviteCode}
              onChange={(e) => set("inviteCode", e.target.value)}
              placeholder="Mã bí mật do quản trị viên cung cấp"
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 6 }}
          >
            {loading ? "Đang tạo..." : "Đăng ký"}
          </button>
        </form>
        <div className="auth-links">
          <span>
            Đã có tài khoản?{" "}
            <Link className="link" href="/login">
              Đăng nhập
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
