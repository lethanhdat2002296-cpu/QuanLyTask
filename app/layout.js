import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Quản Lý Task",
  description: "Quản lý dự án: task khách hàng, câu hỏi, trả lời, giải pháp, trạng thái",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
