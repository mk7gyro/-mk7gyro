export function beginNdjson(res, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeEvent(res, event) {
  if (res.writableEnded) return false;
  return res.write(`${JSON.stringify(event)}\n`);
}

export function writeError(res, status, code, message, requestId) {
  if (!res.headersSent) res.statusCode = status;
  writeEvent(res, { type: "error", error: code, message, requestId });
  res.end();
}

export function safeAgentError(error) {
  const status = Number(error?.status) || 500;
  if (status === 401) return { status: 502, code: "openai_auth_error", message: "The server could not authenticate with OpenAI." };
  if (status === 429) return { status: 429, code: "rate_limited", message: "OpenAI rate limits are temporarily preventing this launch plan." };
  if (status >= 400 && status < 500) return { status, code: "agent_request_failed", message: error?.message || "The agent request was rejected." };
  return { status: 500, code: "agent_failed", message: "Launch Desk could not complete the plan." };
}
