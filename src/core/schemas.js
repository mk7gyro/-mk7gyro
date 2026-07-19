import { z } from "zod";

export const launchChannels = [
  "Release notes",
  "Email",
  "LinkedIn",
  "X / Twitter",
  "In-app",
  "Developer community",
  "Docs",
  "Product Hunt"
];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const launchInputSchema = z.object({
  productBrief: z.string().trim().min(30, "Product brief must be at least 30 characters.").max(5000),
  audience: z.string().trim().min(3, "Audience is required.").max(2000),
  launchDate: z.string().regex(datePattern, "Launch date must use YYYY-MM-DD."),
  constraints: z.string().trim().max(4000).default(""),
  availableAssets: z.string().trim().max(4000).default(""),
  tone: z.string().trim().min(2).max(200).default("Clear, credible, and direct"),
  channels: z.array(z.enum(launchChannels)).min(1, "Select at least one launch channel.").max(8)
}).strict();

export function validateLaunchInput(value) {
  const parsed = launchInputSchema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const first = parsed.error.issues[0];
  return {
    ok: false,
    message: first?.message || "The launch brief is invalid.",
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
  };
}
