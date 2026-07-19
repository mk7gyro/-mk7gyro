import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { campaignPlanSchema } from "../src/campaign/schemas.js";
import { TEXT_MODEL, IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE } from "../src/campaign/config.js";

const client = new OpenAI({ apiKey: "test-key-for-construction-only" });
const format = zodTextFormat(campaignPlanSchema, "campaign_plan");

if (!client.responses || !format || format.type !== "json_schema") {
  throw new Error("Responses API or structured-output helper is unavailable.");
}

console.log(`Responses SDK ready: text=${TEXT_MODEL}, image=${IMAGE_MODEL}, quality=${IMAGE_QUALITY}, size=${IMAGE_SIZE}`);
