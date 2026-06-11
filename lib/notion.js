const NOTION_VERSION = "2022-06-28";

export function isNotionConfigured() {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
}

function textRich(text) {
  return [{ type: "text", text: { content: String(text || "").slice(0, 1900) } }];
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: textRich(text) },
  };
}

function heading(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: textRich(text) },
  };
}

export async function createNotionExportPage({ title, sections = [] }) {
  if (!isNotionConfigured()) {
    const missing = [];
    if (!process.env.NOTION_TOKEN) missing.push("NOTION_TOKEN");
    if (!process.env.NOTION_DATABASE_ID) missing.push("NOTION_DATABASE_ID");
    throw new Error("Thiếu cấu hình Notion: " + missing.join(", "));
  }

  const titleProperty = process.env.NOTION_TITLE_PROPERTY || "Name";
  const children = [];
  for (const section of sections) {
    if (!section?.title && !section?.body) continue;
    if (section.title) children.push(heading(section.title));
    if (section.body) children.push(paragraph(section.body));
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        [titleProperty]: {
          title: textRich(title || "Export từ Quản Lý Task"),
        },
      },
      children: children.slice(0, 80),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Không tạo được page Notion.");
  }
  return data;
}
