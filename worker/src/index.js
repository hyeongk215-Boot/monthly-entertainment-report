// Cloudflare Worker: 중국 지점 접대비 제출/집계 API (D1 사용)
// 배포 방법은 worker/README-deploy.md 참고

const ALLOWED_ORIGINS = ["*"]; // 운영 시 GitHub Pages 주소로 제한 권장 (예: "https://yourname.github.io")

function corsHeaders(origin) {
  var allow = ALLOWED_ORIGINS.includes("*") ? "*" : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: corsHeaders(origin) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      if (url.pathname === "/api/submit" && request.method === "POST") {
        return await handleSubmit(request, env, origin);
      }
      if (url.pathname === "/api/aggregate" && request.method === "GET") {
        return await handleAggregate(request, env, url, origin);
      }
      if (url.pathname === "/api/entry" && request.method === "DELETE") {
        return await handleDeleteEntry(request, env, url, origin);
      }
      return json({ error: "not_found" }, 404, origin);
    } catch (err) {
      return json({ error: "server_error", message: String(err) }, 500, origin);
    }
  }
};

async function handleSubmit(request, env, origin) {
  const body = await request.json();
  const { corp, region, yearmonth, submittedBy, office, submitKey, rows } = body;

  if (!corp || !region || !yearmonth || !submittedBy || !Array.isArray(rows) || rows.length === 0) {
    return json({ error: "invalid_payload" }, 400, origin);
  }
  if (env.SUBMIT_KEY && env.SUBMIT_KEY.length > 0 && submitKey !== env.SUBMIT_KEY) {
    return json({ error: "invalid_submit_key" }, 403, origin);
  }

  const now = new Date().toISOString();

  // 같은 법인/지역/적용년도월/사용자로 재제출하면 "그 사용자"의 기존 내역만 덮어씀
  // (한 PC에서 여러 사용자 몫을 대리 작성할 수 있으므로, 사용자가 다르면 서로 덮어쓰지 않습니다)
  await env.DB.prepare(
    "DELETE FROM entries WHERE corp = ? AND region = ? AND yearmonth = ? AND submitted_by = ?"
  ).bind(corp, region, yearmonth, submittedBy).run();

  const stmt = env.DB.prepare(
    `INSERT INTO entries (corp, region, yearmonth, office, submitted_by, submitted_at, date, currency, amount, cny_amount, vendor, headcount, note, pre_approved)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const batch = rows.map((r) =>
    stmt.bind(
      corp, region, yearmonth, office || "", submittedBy, now,
      r.date || "", r.currency || "CNY", Number(r.amount) || 0, Number(r.cnyAmount) || 0,
      r.vendor || "", Number(r.headcount) || 0, r.note || "", r.preApproved ? 1 : 0
    )
  );
  await env.DB.batch(batch);

  return json({ ok: true, inserted: rows.length }, 200, origin);
}

async function handleAggregate(request, env, url, origin) {
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: "unauthorized" }, 401, origin);
  }
  const yearmonth = url.searchParams.get("yearmonth");
  if (!yearmonth) return json({ error: "yearmonth_required" }, 400, origin);

  const rowsRes = await env.DB.prepare(
    `SELECT id, corp, region, office, submitted_by as submittedBy, submitted_at as submittedAt,
            date, currency, amount, cny_amount as cnyAmount, vendor, headcount, note, pre_approved as preApproved
     FROM entries WHERE yearmonth = ? ORDER BY corp, region, submitted_by, date`
  ).bind(yearmonth).all();

  const subRes = await env.DB.prepare(
    `SELECT corp, region, submitted_by as submittedBy, MAX(submitted_at) as submittedAt
     FROM entries WHERE yearmonth = ? GROUP BY corp, region`
  ).bind(yearmonth).all();

  return json({ rows: rowsRes.results || [], submissions: subRes.results || [] }, 200, origin);
}

async function handleDeleteEntry(request, env, url, origin) {
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: "unauthorized" }, 401, origin);
  }
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id_required" }, 400, origin);

  await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  return json({ ok: true }, 200, origin);
}
