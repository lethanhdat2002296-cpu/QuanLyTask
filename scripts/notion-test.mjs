// Kiểm tra nhanh kết nối Notion API.
// Cách chạy:  node scripts/notion-test.mjs   (đọc NOTION_TOKEN/NOTION_DATABASE_ID từ .env.local)
import process from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // không sao nếu biến môi trường đã có sẵn
}

const TOKEN = process.env.NOTION_TOKEN;
const DB_RAW = process.env.NOTION_DATABASE_ID;
// tự cắt ?v=..., dấu "-", tiền tố URL -> lấy 32 ký tự hex của database id
const DB =
  String(DB_RAW || "").trim().split("?")[0].replace(/-/g, "").match(/[0-9a-fA-F]{32}/)?.[0] ||
  DB_RAW;
const TITLE_PROP = process.env.NOTION_TITLE_PROPERTY || "Name";

if (!TOKEN || !DB) {
  console.error("❌ Thiếu NOTION_TOKEN hoặc NOTION_DATABASE_ID trong .env.local");
  process.exit(1);
}
console.log("Token: ...", TOKEN.slice(-4), "| Database:", DB.slice(0, 8) + "…");

const res = await fetch("https://api.notion.com/v1/pages", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  },
  body: JSON.stringify({
    parent: { database_id: DB },
    properties: {
      [TITLE_PROP]: {
        title: [{ type: "text", text: { content: "✅ Test từ Quản Lý Task" } }],
      },
    },
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "Page test" } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Nếu bạn thấy page này trong Notion database, nghĩa là API đã hoạt động đúng.",
              },
            },
          ],
        },
      },
    ],
  }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("❌ LỖI (" + res.status + "):", data?.message || JSON.stringify(data));
  if (res.status === 404) console.error("   → Thường do CHƯA share database cho integration, hoặc sai Database ID.");
  if (/property/i.test(data?.message || "")) console.error("   → Cột tiêu đề không tên '" + TITLE_PROP + "'. Đặt NOTION_TITLE_PROPERTY cho đúng.");
  process.exit(1);
}
console.log("✅ Tạo page thành công! Mở để kiểm tra:");
console.log("   " + data.url);
