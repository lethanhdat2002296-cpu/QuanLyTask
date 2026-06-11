"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.status === 403) {
      setDenied(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users || []);
    setCurrentUserId(data.currentUserId);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleAdmin(u) {
    if (!u) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/users/${u.id}/toggle-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !u.is_admin }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Thất bại");
      return;
    }
    setToggleTarget(null);
    load();
  }

  async function resetPassword(u) {
    if (!u) return;
    const pw = resetPasswordValue;
    if (!pw) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Thất bại");
      return;
    }
    setResetTarget(null);
    setResetPasswordValue("");
    setNotice(`Đã đặt lại mật khẩu cho "${u.username}".`);
  }

  async function deleteUser(u) {
    if (!u) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Thất bại");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  return (
    <AppShell>
      <div style={{ marginBottom: 8 }}>
        <span
            className="link"
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/")}
          >
            ← Về trang chính
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: 18 }}>
          Quản trị người dùng
        </h1>

        {denied ? (
          <div className="alert">Bạn không có quyền truy cập trang này.</div>
        ) : loading ? (
          <p className="muted">Đang tải...</p>
        ) : error ? (
          <div className="alert">{error}</div>
        ) : (
          <>
          {notice && <div className="alert success">{notice}</div>}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Email</th>
                  <th>Quyền</th>
                  <th style={{ textAlign: "center" }}>Số dự án</th>
                  <th style={{ textAlign: "right" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td>
                        <b>{u.username}</b>
                        {isSelf && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {" "}
                            (bạn)
                          </span>
                        )}
                      </td>
                      <td className="muted">{u.email || "—"}</td>
                      <td>
                        {u.is_admin ? (
                          <span
                            className="badge"
                            style={{ background: "#7c3aed" }}
                          >
                            Admin
                          </span>
                        ) : (
                          <span className="pill">User</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>{u.project_count}</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setResetTarget(u);
                              setResetPasswordValue("");
                            }}
                          >
                            Đặt lại MK
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setToggleTarget(u)}
                            disabled={isSelf}
                            title={isSelf ? "Không thể đổi quyền của chính mình" : ""}
                          >
                            {u.is_admin ? "Bỏ admin" : "Cấp admin"}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteTarget(u)}
                            disabled={isSelf}
                            title={isSelf ? "Không thể tự xóa" : ""}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Đặt lại mật khẩu</h2>
            <p className="muted" style={{ marginTop: -6 }}>
              Nhập mật khẩu mới cho "{resetTarget.username}".
            </p>
            <div className="field">
              <label>Mật khẩu mới *</label>
              <input
                className="input"
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setResetTarget(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={resetPasswordValue.length < 6}
                onClick={() => resetPassword(resetTarget)}
              >
                Đặt lại mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.is_admin ? "Bỏ quyền admin?" : "Cấp quyền admin?"}
        message={
          toggleTarget
            ? `Xác nhận thay đổi quyền của "${toggleTarget.username}".`
            : ""
        }
        confirmText={toggleTarget?.is_admin ? "Bỏ admin" : "Cấp admin"}
        onCancel={() => setToggleTarget(null)}
        onConfirm={() => toggleAdmin(toggleTarget)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa người dùng?"
        message={
          deleteTarget
            ? `Người dùng "${deleteTarget.username}" và toàn bộ dự án/task của họ sẽ bị xóa.`
            : ""
        }
        confirmText="Xóa người dùng"
        danger
        requireText={deleteTarget?.username || ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteUser(deleteTarget)}
      />
    </AppShell>
  );
}
