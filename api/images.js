import { randomUUID } from "node:crypto";
import { generateCampaignImages } from "../src/campaign/openai.js";
import { validateImageRequest } from "../src/campaign/schemas.js";
import { mapOpenAIError, sendJson } from "../src/server/errors.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use POST to render campaign images." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "server_not_configured", message: "OPENAI_API_KEY is not configured on the server." });
  }

  const parsed = validateImageRequest(req.body || {});
  if (!parsed.ok) return sendJson(res, 400, { error: "invalid_input", message: parsed.message });

  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const result = await generateCampaignImages(parsed.data);
    return sendJson(res, 200, {
      requestId,
      durationMs: Date.now() - startedAt,
      ...result
    });
  } catch (error) {
    const mapped = mapOpenAIError(error);
    console.error("Campaign image generation failed", {
      requestId,
      name: error?.name,
      status: error?.status,
      message: error?.message
    });
    return sendJson(res, mapped.status, { error: mapped.code, message: mapped.message, requestId });
  }
}
