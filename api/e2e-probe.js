import agentHandler from "./agent.js";

const PROBE_TOKEN = "ld-20260719-93f4b7c1";

function createProbeResponse(resolve) {
  const headers = new Map();
  let statusCode = 200;
  let body = "";
  return {
    get statusCode() { return statusCode; },
    set statusCode(value) { statusCode = value; },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    status(value) { statusCode = value; return this; },
    json(value) { body += JSON.stringify(value); resolve({ statusCode, body, headers }); return this; },
    write(chunk) { body += String(chunk); return true; },
    flushHeaders() {},
    end(chunk = "") { body += String(chunk); resolve({ statusCode, body, headers }); }
  };
}

function parseEvents(body) {
  return body.split("\n\n").map((block) => {
    const type = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
    const raw = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return type ? { type, data } : null;
  }).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET" || req.query?.token !== PROBE_TOKEN) {
    return res.status(404).json({ error: "not_found" });
  }

  const result = await new Promise((resolve) => {
    agentHandler({
      method: "POST",
      body: {
        brief: "Launch a developer-facing incident review assistant with a beta demo. It requires security approval, rollback, monitoring, support coverage, and weekly active teams as the success metric.",
        audience: "Site reliability and platform engineering teams",
        launchDate: "2026-09-15",
        constraints: "Two engineers; security sign-off; no pricing change",
        assets: "Beta demo; documentation draft; three design partner quotes"
      }
    }, createProbeResponse(resolve));
  });

  const events = parseEvents(result.body);
  const sawTool = events.some((event) => event.type === "tool.started" || event.type === "tool.completed");
  const sawText = events.some((event) => event.type === "text.delta" && event.data?.delta);
  const failed = events.find((event) => event.type === "run.failed");
  return res.status(sawTool && sawText ? 200 : 502).json({
    ok: sawTool && sawText,
    sawTool,
    sawText,
    eventTypes: events.map((event) => event.type),
    failure: failed?.data || null
  });
}
