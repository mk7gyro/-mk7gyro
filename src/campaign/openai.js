import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { campaignPlanSchema } from "./schemas.js";
import { CAMPAIGN_SYSTEM_PROMPT, formatCampaignBrief, formatImagePrompt } from "./prompts.js";
import { IMAGE_COUNT, IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, TEXT_MODEL } from "./config.js";

let client;

function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function extractImageResult(response) {
  const call = response?.output?.find((item) => item.type === "image_generation_call" && item.result);
  return call?.result || null;
}

export async function generateCampaignPlan(input) {
  const response = await getClient().responses.parse({
    model: TEXT_MODEL,
    instructions: CAMPAIGN_SYSTEM_PROMPT,
    input: formatCampaignBrief(input),
    reasoning: { effort: "low" },
    text: {
      format: zodTextFormat(campaignPlanSchema, "campaign_plan"),
      verbosity: "medium"
    },
    store: false,
    metadata: {
      app: "campaign-concept-studio",
      workflow: "campaign-plan"
    }
  });

  if (!response.output_parsed) {
    throw new Error("The campaign response did not contain a valid structured plan.");
  }

  return {
    plan: response.output_parsed,
    meta: {
      responseId: response.id,
      model: TEXT_MODEL,
      usage: response.usage || null
    }
  };
}

async function generateOneImage(request, direction) {
  const response = await getClient().responses.create({
    model: IMAGE_MODEL,
    instructions: "Use the image generation tool to produce the requested campaign key art. Return an image, not a prose-only answer.",
    input: formatImagePrompt({ ...request, direction }),
    tools: [
      {
        type: "image_generation",
        quality: IMAGE_QUALITY,
        size: IMAGE_SIZE
      }
    ],
    store: false,
    metadata: {
      app: "campaign-concept-studio",
      workflow: "campaign-image"
    }
  });

  const base64 = extractImageResult(response);
  if (!base64) throw new Error(`No image was returned for “${direction.title}”.`);

  return {
    title: direction.title,
    prompt: direction.prompt,
    altText: direction.altText,
    dataUrl: `data:image/png;base64,${base64}`,
    responseId: response.id
  };
}

export async function generateCampaignImages(request) {
  const directions = request.imageDirections.slice(0, IMAGE_COUNT);
  const settled = await Promise.allSettled(
    directions.map((direction) => generateOneImage(request, direction))
  );

  const images = [];
  const warnings = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") images.push(result.value);
    else warnings.push(`Could not render ${directions[index].title}.`);
  });

  if (!images.length) {
    const error = new Error("Image generation did not return any campaign images.");
    error.cause = settled.map((result) => result.status === "rejected" ? result.reason : null);
    throw error;
  }

  return {
    images,
    warnings,
    meta: {
      model: IMAGE_MODEL,
      quality: IMAGE_QUALITY,
      size: IMAGE_SIZE,
      requested: directions.length,
      completed: images.length
    }
  };
}
