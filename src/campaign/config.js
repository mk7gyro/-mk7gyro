const allowedQualities = new Set(["low", "medium", "high", "auto"]);
const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"]);

function readCount(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.min(3, Math.max(1, parsed)) : fallback;
}

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-5.6-terra";
export const IMAGE_COUNT = readCount(process.env.CAMPAIGN_IMAGE_COUNT, 2);
export const IMAGE_QUALITY = allowedQualities.has(process.env.CAMPAIGN_IMAGE_QUALITY)
  ? process.env.CAMPAIGN_IMAGE_QUALITY
  : "low";
export const IMAGE_SIZE = allowedSizes.has(process.env.CAMPAIGN_IMAGE_SIZE)
  ? process.env.CAMPAIGN_IMAGE_SIZE
  : "1024x1024";
