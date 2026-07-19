import { tool } from "@openai/agents";
import { z } from "zod";
import { extractLaunchTasks, checkLaunchReadiness, generateOwnerChecklist, draftLaunchCopy } from "../core/planning.js";

const intakeSchema = z.object({
  brief: z.string().describe("The product or release brief."),
  audience: z.string().describe("Primary launch audience."),
  launchDate: z.string().describe("Target launch date or an empty string."),
  constraints: z.string().describe("Known constraints or an empty string."),
  assets: z.string().describe("Available assets or an empty string.")
});

export const extractTasksTool = tool({
  name: "extract_launch_tasks",
  description: "Extract and prioritize concrete launch tasks from the product intake. Use this before writing the launch plan.",
  parameters: intakeSchema,
  timeoutMs: 5000,
  async execute(input) { return extractLaunchTasks(input); }
});

export const readinessTool = tool({
  name: "check_launch_readiness",
  description: "Score launch readiness against strategy, timing, constraints, assets, operations, measurement, and risk criteria.",
  parameters: intakeSchema,
  timeoutMs: 5000,
  async execute(input) { return checkLaunchReadiness(input); }
});

export const ownerChecklistTool = tool({
  name: "generate_owner_checklist",
  description: "Generate role-based owner checklists for engineering, product, marketing, support, data, and the launch lead.",
  parameters: intakeSchema,
  timeoutMs: 5000,
  async execute(input) { return generateOwnerChecklist(input); }
});

export const launchCopyTool = tool({
  name: "draft_launch_copy",
  description: "Draft channel-specific launch copy for internal Slack, customer email, social, and changelog surfaces.",
  parameters: intakeSchema,
  timeoutMs: 5000,
  async execute(input) { return draftLaunchCopy(input); }
});

export const launchTools = [extractTasksTool, readinessTool, ownerChecklistTool, launchCopyTool];
