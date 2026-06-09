"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra");
      } else {
        setMessage(data.message || "Đã gửi email nếu tài khoản tồn tại.");
      }
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🔑 Quên mật khẩu</h1>
        <p className="sub">Nhập email để nhận link đặt lại mật khẩu</p>
        {error && <div className="alert">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email tài khoản</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 6 }}
            >
              {loading ? "Đang gửi..." : "Gửi link đặt lại"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link className="link" href="/login">
            ← Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
