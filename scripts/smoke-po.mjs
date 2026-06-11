// Smoke test PO an toàn: tạo dữ liệu QA tạm rồi cleanup trong finally.
// Chạy khi dev server đang bật:
//   SMOKE_BASE=http://localhost:3000 SMOKE_USERNAME=admin SMOKE_PASSWORD=... node scripts/smoke-po.mjs

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const username = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;

if (!username || !password) {
  console.error("Thiếu SMOKE_USERNAME / SMOKE_PASSWORD.");
  process.exit(1);
}

let cookie = "";
let projectId = null;

async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function check(name, cond, extra = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${extra ? " - " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

try {
  let r = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  check("login", r.status === 200, "status=" + r.status);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  r = await call("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "QA-PO-" + stamp, description: "temporary smoke data" }),
  });
  projectId = r.body?.project?.id;
  check("create project", Boolean(projectId));

  const late = await call("/api/po/phases", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      name: "GĐ smoke trễ",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
      status: "Đang làm",
    }),
  });
  const phaseId = late.body?.phase?.id;
  check("create phase", Boolean(phaseId));

  const a = await call("/api/po/backlog", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      phase_id: phaseId,
      title: "Smoke backlog A",
      bucket: "now",
      status: "Hoàn thành",
      business_value: 1,
      effort: 3,
    }),
  });
  const b = await call("/api/po/backlog", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      phase_id: phaseId,
      title: "Smoke backlog B",
      bucket: "now",
      status: "Đã duyệt",
      business_value: 2,
      effort: 1,
    }),
  });
  check("create backlog items", Boolean(a.body?.item?.id && b.body?.item?.id));

  r = await call("/api/po/backlog/reorder", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      bucket: "now",
      orderedIds: [b.body.item.id, a.body.item.id],
    }),
  });
  check("reorder backlog", r.status === 200, "status=" + r.status);

  r = await call(`/api/po/phases?project=${projectId}`);
  const ph = r.body?.phases?.[0];
  check("phase overdue", ph?.is_overdue === true);
  check("phase effort", ph?.total_effort === 4 && ph?.done_effort === 3);

  if (process.env.SMOKE_AI === "1") {
    r = await call("/api/po/analyze", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId }),
    });
    check("ai analyze controlled", [200, 429, 503].includes(r.status), "status=" + r.status);
  }
} finally {
  if (projectId) {
    await call(`/api/projects/${projectId}`, { method: "DELETE" });
    console.log("cleanup project " + projectId);
  }
}
