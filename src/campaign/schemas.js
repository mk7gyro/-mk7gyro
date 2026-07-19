import { z } from "zod";

export const CHANNELS = [
  "Landing page",
  "Email",
  "LinkedIn",
  "Instagram",
  "Paid social",
  "In-product",
  "Sales enablement",
  "Event"
];

export const campaignInputSchema = z.object({
  brief: z.string().trim().min(20).max(4000),
  audience: z.string().trim().min(3).max(2000),
  productDetails: z.string().trim().min(10).max(4000),
  tone: z.string().trim().min(2).max(300),
  channels: z.array(z.enum(CHANNELS)).min(1).max(6)
});

const copyVariantSchema = z.object({
  label: z.string().min(1).max(60),
  headline: z.string().min(1).max(140),
  body: z.string().min(1).max(700),
  cta: z.string().min(1).max(80)
});

const checklistItemSchema = z.object({
  phase: z.enum(["Foundation", "Production", "Launch", "Measurement"]),
  item: z.string().min(1).max(220),
  owner: z.string().min(1).max(80),
  priority: z.enum(["P0", "P1", "P2"])
});

const imageDirectionSchema = z.object({
  title: z.string().min(1).max(80),
  prompt: z.string().min(40).max(1400),
  altText: z.string().min(10).max(240)
});

export const campaignPlanSchema = z.object({
  concept: z.object({
    name: z.string().min(1).max(90),
    oneLiner: z.string().min(1).max(220),
    bigIdea: z.string().min(1).max(700),
    audienceInsight: z.string().min(1).max(500),
    keyMessage: z.string().min(1).max(300),
    visualDirection: z.string().min(1).max(500)
  }),
  copyVariants: z.array(copyVariantSchema).length(3),
  checklist: z.array(checklistItemSchema).min(6).max(12),
  imageDirections: z.array(imageDirectionSchema).length(2),
  assumptions: z.array(z.string().min(1).max(240)).max(5)
});

export const imageRequestSchema = z.object({
  campaignName: z.string().trim().min(1).max(90),
  tone: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(2000),
  imageDirections: z.array(imageDirectionSchema).min(1).max(3)
});

export function validateCampaignInput(value) {
  const result = campaignInputSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const message = result.error.issues.map((issue) => issue.message).join(" ");
  return { ok: false, message };
}

export function validateImageRequest(value) {
  const result = imageRequestSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const message = result.error.issues.map((issue) => issue.message).join(" ");
  return { ok: false, message };
}
