"use client";

import { useEffect, useState } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  danger = false,
  requireText = "",
  onCancel,
  onConfirm,
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open, requireText]);

  // Đóng bằng phím Esc khi đang mở
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const needsText = Boolean(requireText);
  const disabled = needsText && typed.trim() !== requireText;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {message && <p className="muted" style={{ marginTop: -6 }}>{message}</p>}
        {needsText && (
          <div className="field">
            <label>
              Nhập <b>{requireText}</b> để xác nhận
            </label>
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={"btn" + (danger ? " btn-danger" : " btn-primary")}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
