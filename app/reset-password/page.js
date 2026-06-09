"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Mật khẩu mới tối thiểu 6 ký tự");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đặt lại mật khẩu thất bại");
      } else {
        setDone(true);
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
        <h1>🔒 Đặt lại mật khẩu</h1>
        {done ? (
          <>
            <div className="alert success">
              Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.
            </div>
            <Link
              className="btn btn-primary"
              href="/login"
              style={{ width: "100%", marginTop: 6 }}
            >
              Đến trang đăng nhập
            </Link>
          </>
        ) : (
          <>
            <p className="sub">Nhập mật khẩu mới cho tài khoản của bạn</p>
            {error && <div className="alert">{error}</div>}
            {!token && (
              <div className="alert">
                Link không hợp lệ (thiếu mã đặt lại). Hãy mở đúng link trong email.
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Mật khẩu mới</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div className="field">
                <label>Nhập lại mật khẩu</label>
                <input
                  className="input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !token}
                style={{ width: "100%", marginTop: 6 }}
              >
                {loading ? "Đang lưu..." : "Đặt lại mật khẩu"}
              </button>
            </form>
            <div className="auth-links">
              <Link className="link" href="/login">
                ← Quay lại đăng nhập
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
