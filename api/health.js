import { AGENT_MODEL, REASONING_EFFORT, TRACING_DISABLED } from "../src/agent/config.js";
import { sendJson } from "../src/server/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use GET for health checks." });
  }
  return sendJson(res, 200, {
    ok: true,
    app: "launch-desk",
    sdk: "@openai/agents",
    model: AGENT_MODEL,
    reasoningEffort: REASONING_EFFORT,
    tracing: TRACING_DISABLED ? "disabled" : "enabled",
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
}
