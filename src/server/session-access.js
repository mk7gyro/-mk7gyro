import { createHash, timingSafeEqual } from "node:crypto";

export function configuredOrigin(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const secure = url.protocol === "https:";
    const local = url.protocol === "http:" && url.hostname === "127.0.0.1";
    if ((!secure && !local) || value !== url.origin || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const validToken = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
const digest = (value) => createHash("sha256").update(value, "utf8").digest();

export function authorizeSessionRequest(req, env = process.env) {
  const origin = configuredOrigin(env.PUBLIC_ORIGIN);
  // Never mint paid client secrets when the application's access boundary is absent.
  if (!origin || !validToken(env.REALTIME_ACCESS_TOKEN)) {
    return { ok: false, status: 503, error: "access_not_configured", message: "Session access is not configured on the server." };
  }

  const authorization = req.headers?.authorization;
  const match = typeof authorization === "string" && /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(authorization);
  // Compare fixed-size digests so differently sized credentials cannot throw or compare by prefix.
  if (!match || !timingSafeEqual(digest(match[1]), digest(env.REALTIME_ACCESS_TOKEN))) {
    return { ok: false, status: 401, error: "unauthorized", message: "Enter a valid room access code." };
  }

  // Origin is an additional browser request boundary, not a substitute for authentication.
  if (req.headers?.origin !== origin) {
    return { ok: false, status: 403, error: "origin_not_allowed", message: "This request origin is not allowed." };
  }

  const contentType = req.headers?.["content-type"];
  if (typeof contentType !== "string" || contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, error: "unsupported_media_type", message: "Send an application/json request." };
  }
  return { ok: true };
}
