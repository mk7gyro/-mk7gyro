export const CAMPAIGN_SYSTEM_PROMPT = `You are a senior integrated campaign strategist and creative director. Turn a short marketing intake into a practical, differentiated campaign platform.

Produce a concise concept, exactly three meaningfully different copy variants, a launch checklist, and exactly two production-ready image directions.

Rules:
- Ground every claim in the supplied product details. Do not invent metrics, customer quotes, awards, availability, or proof points.
- Make the audience insight specific enough to guide creative choices.
- The concept must be executable across the requested channels, not a vague theme.
- Copy variants must differ in strategic angle, not merely wording.
- Checklist items must be actionable, prioritized, and assigned to a useful owner role.
- Image prompts must describe campaign key art, composition, lighting, palette, subject, environment, typography treatment, and exclusions.
- Image prompts should request no logos, no trademarked characters, no unreadable text, and no unsupported product UI.
- Keep assumptions explicit and minimal.
- Return only the structured response.`;

export function formatCampaignBrief(input) {
  return [
    `CAMPAIGN BRIEF\n${input.brief}`,
    `TARGET AUDIENCE\n${input.audience}`,
    `PRODUCT DETAILS\n${input.productDetails}`,
    `TONE\n${input.tone}`,
    `CHANNELS\n${input.channels.join(", ")}`,
    "Create a campaign direction that a marketing team can move into production this week."
  ].join("\n\n");
}

export function formatImagePrompt({ direction, campaignName, tone, audience }) {
  return `Create one polished campaign key-art image for the campaign “${campaignName}”.

Audience: ${audience}
Tone: ${tone}
Creative direction: ${direction.prompt}

Treat this as finished advertising art with a clear focal point and generous negative space for later copy placement. Do not render logos, brand marks, watermarks, legible marketing copy, trademarked characters, or unsupported product interface details. The image must stand on its own without text.`;
}
