const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

// Lấy đúng 32 ký tự hex của Database ID từ chuỗi người dùng dán
// (tự bỏ phần ?v=..., bỏ dấu "-", bỏ tiền tố URL nếu dán cả link).
export function cleanDatabaseId(raw) {
  const s = String(raw || "")
    .trim()
    .split("?")[0]
    .replace(/-/g, "");
  const m = s.match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : String(raw || "").trim();
}

export function isNotionConfigured() {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function textRich(text) {
  return [{ type: "text", text: { content: String(text || "").slice(0, 1900) } }];
}

// Mỗi section = 1 đoạn văn: "Nhãn: nội dung" (nhãn in đậm). Bỏ section rỗng.
function sectionBlocks(sections = []) {
  const blocks = [];
  for (const s of sections) {
    if (!s || (!s.title && !s.body)) continue;
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: s.title ? s.title + ": " : "" },
            annotations: { bold: true },
          },
          { type: "text", text: { content: String(s.body || "").slice(0, 1900) } },
        ],
      },
    });
  }
  return blocks.slice(0, 90);
}

// Gọi Notion API, ném lỗi kèm status nếu thất bại.
async function notionFetch(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || "Lỗi gọi Notion API.");
    err.status = res.status;
    throw err;
  }
  return data;
}

function assertConfigured() {
  if (!isNotionConfigured()) {
    const missing = [];
    if (!process.env.NOTION_TOKEN) missing.push("NOTION_TOKEN");
    if (!process.env.NOTION_DATABASE_ID) missing.push("NOTION_DATABASE_ID");
    throw new Error("Thiếu cấu hình Notion: " + missing.join(", "));
  }
}

const titleProp = () => process.env.NOTION_TITLE_PROPERTY || "Name";

async function createPage({ title, sections }) {
  const data = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: cleanDatabaseId(process.env.NOTION_DATABASE_ID) },
      properties: {
        [titleProp()]: { title: textRich(title || "Export từ Quản Lý Task") },
      },
      children: sectionBlocks(sections),
    }),
  });
  return { id: data.id, url: data.url };
}

async function updatePage(pageId, { title, sections }) {
  // 1) Cập nhật tiêu đề (đồng thời xác nhận page còn tồn tại; nếu bị xoá -> ném 404).
  const page = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        [titleProp()]: { title: textRich(title || "Export từ Quản Lý Task") },
      },
    }),
  });
  // 2) Xoá nội dung cũ (Notion không có lệnh "thay toàn bộ", phải xoá rồi ghi lại).
  const children = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
  for (const b of children.results || []) {
    try {
      await notionFetch(`/blocks/${b.id}`, { method: "DELETE" });
    } catch {
      // bỏ qua 1 block lỗi, vẫn ghi nội dung mới
    }
  }
  // 3) Ghi nội dung mới.
  await notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({ children: sectionBlocks(sections) }),
  });
  return { id: pageId, url: page.url };
}

// Tạo MỚI hoặc CẬP NHẬT page Notion. Trả { id, url, updated }.
// - pageId rỗng  -> tạo mới.
// - pageId có    -> cập nhật; nếu page đã bị xoá trong Notion (404/400) -> tạo mới.
export async function upsertNotionExportPage({ pageId, title, sections }) {
  assertConfigured();
  if (pageId) {
    try {
      const r = await updatePage(pageId, { title, sections });
      return { ...r, updated: true };
    } catch (e) {
      if (e.status === 404 || e.status === 400) {
        const r = await createPage({ title, sections });
        return { ...r, updated: false };
      }
      throw e;
    }
  }
  const r = await createPage({ title, sections });
  return { ...r, updated: false };
}
