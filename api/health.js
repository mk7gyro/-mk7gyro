import { DEFAULT_VOICE, REALTIME_MODEL, TRANSCRIPTION_MODEL } from "../src/realtime/config.js";
import { sendJson } from "../src/server/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use GET for health checks." });
  }
  return sendJson(res, 200, {
    ok: true,
    app: "world-room",
    transport: "WebRTC",
    model: REALTIME_MODEL,
    transcriptionModel: TRANSCRIPTION_MODEL,
    defaultVoice: DEFAULT_VOICE,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
}
