export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function mapOpenAIError(error) {
  const status = Number(error?.status || 0);
  if (status === 429) {
    return { status: 429, code: "rate_limited", message: "The studio is receiving too many requests. Try again shortly." };
  }
  if (status === 401 || status === 403) {
    return { status: 503, code: "openai_access_error", message: "The server cannot access the configured OpenAI project." };
  }
  if (status >= 500) {
    return { status: 502, code: "upstream_error", message: "OpenAI could not complete this stage. Try again." };
  }
  if (error?.name === "APIConnectionTimeoutError" || error?.name === "APIConnectionError") {
    return { status: 504, code: "connection_error", message: "The OpenAI request timed out or lost its connection." };
  }
  return { status: 500, code: "generation_failed", message: "The studio could not complete this stage." };
}
