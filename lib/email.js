import nodemailer from "nodemailer";

// Kiểm tra đã cấu hình SMTP chưa
export function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Gửi email chứa link đặt lại mật khẩu
export async function sendResetEmail(to, resetUrl) {
  if (!isEmailConfigured()) {
    throw new Error(
      "Chưa cấu hình gửi email (SMTP_HOST/SMTP_USER/SMTP_PASS). Xem README."
    );
  }
  const from =
    process.env.SMTP_FROM || `Quản Lý Task <${process.env.SMTP_USER}>`;

  await getTransport().sendMail({
    from,
    to,
    subject: "Đặt lại mật khẩu - Quản Lý Task",
    text: `Bạn vừa yêu cầu đặt lại mật khẩu.

Nhấn vào link sau để đặt mật khẩu mới (hết hạn sau 1 giờ):
${resetUrl}

Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Đặt lại mật khẩu</h2>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản <b>Quản Lý Task</b>.</p>
        <p>Nhấn nút bên dưới để đặt mật khẩu mới (link hết hạn sau <b>1 giờ</b>):</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            Đặt lại mật khẩu
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">Nếu nút không bấm được, copy link này vào trình duyệt:<br>${resetUrl}</p>
        <p style="color:#6b7280;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>
    `,
  });
}
