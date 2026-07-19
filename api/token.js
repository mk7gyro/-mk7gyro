import { createHash, randomUUID } from "node:crypto";
import {
  REALTIME_MODEL,
  buildSessionConfig
} from "../lib/world-room-config.js";

const OPENAI_CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/client_secrets";
const TOKEN_TIMEOUT_MS = 8_000;

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function anonymousSafetyIdentifier(req) {
  const browserId = String(req.headers["x-world-room-user"] || "").slice(0, 128);
  const fallback = `${req.headers["user-agent"] || "unknown"}:${randomUUID()}`;
  return createHash("sha256")
    .update(browserId || fallback)
    .digest("hex");
}

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "method_not_allowed",
      message: "Use POST to create a Realtime session token."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "server_not_configured",
      message: "World Room is missing its server-side OpenAI configuration."
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": anonymousSafetyIdentifier(req)
      },
      body: JSON.stringify(buildSessionConfig()),
      signal: controller.signal
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!response.ok || !data?.value) {
      console.error("Realtime client secret request failed", {
        status: response.status,
        requestId: response.headers.get("x-request-id")
      });

      return res.status(response.status >= 400 && response.status < 500 ? 502 : 503).json({
        error: "realtime_session_unavailable",
        message: "A voice session could not be created. Please try again.",
        request_id: response.headers.get("x-request-id") || undefined
      });
    }

    return res.status(200).json({
      value: data.value,
      expires_at: data.expires_at,
      model: REALTIME_MODEL
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("Realtime client secret error", {
      type: timedOut ? "timeout" : "network_error"
    });

    return res.status(timedOut ? 504 : 503).json({
      error: timedOut ? "session_token_timeout" : "session_token_error",
      message: timedOut
        ? "Creating the voice session took too long. Please retry."
        : "The voice service is temporarily unavailable. Please retry."
    });
  } finally {
    clearTimeout(timeout);
  }
}
