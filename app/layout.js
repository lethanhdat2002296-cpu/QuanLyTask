import "./globals.css";

export const metadata = {
  title: "Quản Lý Task",
  description: "Quản lý dự án: task khách hàng, câu hỏi, trả lời, giải pháp, trạng thái",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
