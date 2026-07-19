import { randomUUID } from "node:crypto";
import { buildClientSecretRequest, publicSessionConfig, validateSessionRequest } from "../src/realtime/session-token.js";
import { safeUpstreamMessage, sendJson } from "../src/server/http.js";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use POST to create a realtime session." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "server_not_configured", message: "OPENAI_API_KEY is not configured on the server." });
  }

  const parsed = validateSessionRequest(req.body || {});
  if (!parsed.ok) return sendJson(res, 400, { error: "invalid_input", message: parsed.message });

  const requestId = randomUUID();
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildClientSecretRequest(parsed.data))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.value !== "string" || !data.value.startsWith("ek_")) {
      console.error("Realtime client secret creation failed", { requestId, status: response.status, code: data?.error?.code });
      return sendJson(res, response.status || 502, {
        error: "realtime_session_failed",
        message: safeUpstreamMessage(response.status),
        requestId
      });
    }
    return sendJson(res, 200, { requestId, ...publicSessionConfig(parsed.data, data) });
  } catch (error) {
    console.error("Realtime session request failed", { requestId, name: error?.name, message: error?.message });
    return sendJson(res, 502, { error: "realtime_unreachable", message: "The server could not reach OpenAI.", requestId });
  }
}
