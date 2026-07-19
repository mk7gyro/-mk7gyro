export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function safeUpstreamMessage(status) {
  if (status === 401) return "The OpenAI API key was rejected.";
  if (status === 429) return "Realtime capacity is temporarily limited. Try again shortly.";
  if (status >= 500) return "OpenAI could not create a realtime session. Try again.";
  return "The realtime session could not be created.";
}
