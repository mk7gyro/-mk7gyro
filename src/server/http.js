export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function beginNdjson(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

export function safeError(error) {
  const status = Number(error?.status || error?.statusCode || 500);
  if (status === 401) return { status: 502, code: "openai_authentication_failed", message: "The server could not authenticate with OpenAI." };
  if (status === 429) return { status: 429, code: "rate_limited", message: "OpenAI rate limits are currently preventing this plan from completing." };
  if (error?.name === "AbortError") return { status: 499, code: "cancelled", message: "The launch planning run was cancelled." };
  return { status: 500, code: "agent_failed", message: "Launch Desk could not complete the plan." };
}
