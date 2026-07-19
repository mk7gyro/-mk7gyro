import { z } from "zod";

const text = (label, min, max) =>
  z.string({ required_error: `${label} is required.` }).trim().min(min, `${label} is too short.`).max(max, `${label} is too long.`);

export const launchRequestSchema = z.object({
  productBrief: text("Product brief", 20, 5000),
  audience: text("Audience", 3, 2000),
  launchDate: z.string().trim().min(1, "Launch date is required.").max(80),
  constraints: z.string().trim().max(3000).default(""),
  assets: z.string().trim().max(3000).default("")
}).strict();

export function validateLaunchRequest(value) {
  const result = launchRequestSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    message: result.error.issues.map((issue) => issue.message).join(" ")
  };
}

export const taskExtractionSchema = z.object({
  productBrief: z.string().min(10),
  launchDate: z.string().min(1),
  constraints: z.string().default("")
});

export const readinessSchema = z.object({
  productBrief: z.string().min(10),
  audience: z.string().min(1),
  launchDate: z.string().min(1),
  constraints: z.string().default(""),
  assets: z.string().default("")
});

export const ownerChecklistSchema = z.object({
  launchDate: z.string().min(1),
  tasks: z.array(z.string().min(2)).min(1).max(20),
  assets: z.string().default("")
});

export const channelCopySchema = z.object({
  productSummary: z.string().min(10),
  audience: z.string().min(1),
  channels: z.array(z.enum(["release_notes", "email", "social", "in_product"])).min(1).max(4),
  tone: z.string().default("clear, credible, and concise")
});
