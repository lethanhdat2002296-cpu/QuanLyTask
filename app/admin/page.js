"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

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
    const action = u.is_admin ? "bỏ quyền admin của" : "cấp quyền admin cho";
    if (!confirm(`Bạn chắc chắn ${action} "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}/toggle-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !u.is_admin }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Thất bại");
      return;
    }
    load();
  }

  async function resetPassword(u) {
    const pw = prompt(`Nhập mật khẩu MỚI cho "${u.username}" (tối thiểu 6 ký tự):`);
    if (!pw) return;
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error || "Thất bại");
      return;
    }
    alert(`Đã đặt lại mật khẩu cho "${u.username}".`);
  }

  async function deleteUser(u) {
    if (
      !confirm(
        `Xóa người dùng "${u.username}"? Toàn bộ dự án & task của họ cũng bị xóa. Không thể hoàn tác.`
      )
    )
      return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Thất bại");
      return;
    }
    load();
  }

  return (
    <>
      <Topbar />
      <div className="container">
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
                            onClick={() => resetPassword(u)}
                          >
                            Đặt lại MK
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => toggleAdmin(u)}
                            disabled={isSelf}
                            title={isSelf ? "Không thể đổi quyền của chính mình" : ""}
                          >
                            {u.is_admin ? "Bỏ admin" : "Cấp admin"}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteUser(u)}
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
        )}
      </div>
    </>
  );
}
