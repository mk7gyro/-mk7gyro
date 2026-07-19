import { tool } from "@openai/agents";
import { z } from "zod";
import {
  assessReadiness,
  buildOwnerChecklist,
  createChannelCopyBriefs,
  extractTasks,
  summarizeToolData
} from "../core/planning.js";

const noArguments = z.object({}).strict();

function toolFromContext({ name, description, run }) {
  return tool({
    name,
    description,
    parameters: noArguments,
    timeoutMs: 8_000,
    timeoutBehavior: "error_as_result",
    async execute(_args, runContext) {
      const context = runContext?.context;
      if (!context?.launchInput) throw new Error("Launch context is unavailable.");
      const data = run(context.launchInput);
      const summary = summarizeToolData(name, data);
      context.reportTool?.({ tool: name, phase: "completed", summary, data });
      return JSON.stringify(data);
    },
    errorFunction(_context, error) {
      return `The ${name} tool could not complete: ${error?.message || "unknown error"}`;
    }
  });
}

export const extractLaunchTasksTool = toolFromContext({
  name: "extract_launch_tasks",
  description: "Extract a bounded, prioritized engineering launch task list from the current launch brief. Call this before drafting the final plan.",
  run: extractTasks
});

export const checkLaunchReadinessTool = toolFromContext({
  name: "check_launch_readiness",
  description: "Score the current launch against a readiness rubric and identify blockers, gaps, and schedule risk. Call this before recommending a release posture.",
  run: assessReadiness
});

export const generateOwnerChecklistsTool = toolFromContext({
  name: "generate_owner_checklists",
  description: "Generate role-based owner checklists for engineering, product, launch, marketing, and support from the current launch context.",
  run: buildOwnerChecklist
});

export const draftChannelCopyTool = toolFromContext({
  name: "draft_channel_copy",
  description: "Create channel-specific copy briefs, limits, CTA guidance, and message seeds for the selected launch channels.",
  run: createChannelCopyBriefs
});

export const launchTools = [
  extractLaunchTasksTool,
  checkLaunchReadinessTool,
  generateOwnerChecklistsTool,
  draftChannelCopyTool
];
