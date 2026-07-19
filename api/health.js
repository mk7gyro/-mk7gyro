import { AGENT_MODEL } from "../src/agent/config.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  return res.status(200).json({
    ok: true,
    app: "launch-desk",
    model: AGENT_MODEL,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    tracing: process.env.OPENAI_AGENTS_DISABLE_TRACING === "1" ? "disabled" : "enabled"
  });
}
