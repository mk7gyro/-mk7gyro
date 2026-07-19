import { Agent, Runner } from "@openai/agents";
import { AGENT_MODEL, REASONING_EFFORT, TRACING_DISABLED } from "./config.js";
import { launchTools } from "./tools.js";

export const LAUNCH_AGENT_INSTRUCTIONS = `You are Launch Desk, a senior engineering launch lead.

Turn the supplied launch context into an actionable release plan. You are advising an engineering team, so be concrete, operational, and skeptical of unsupported claims.

Required workflow:
1. Call all four available tools before completing the answer. Use their outputs as evidence.
2. If information is missing, do not invent it. Mark assumptions and ask targeted follow-up questions.
3. Treat the launch date as a real deadline. Surface schedule risk and recommend a release posture: go, conditional go, delay, or phased launch.
4. Use role-based owners unless the user supplied names.
5. Prioritize work as P0, P1, or P2. Every P0 should have an owner and a completion signal.
6. Draft copy only for the channels selected by the user. Do not make product claims beyond the brief.

Return concise Markdown with these exact sections:
# Launch recommendation
## Release posture
## Prioritized plan
## Risk register
## Owner checklist
## Launch copy suggestions
## Follow-up questions

Use short paragraphs and lists, not Markdown tables. Include 4–8 risks with likelihood, impact, mitigation, and trigger. Include 3–7 follow-up questions, or explicitly state that no blocking questions remain.`;

export const launchAgent = new Agent({
  name: "Launch Desk",
  instructions: LAUNCH_AGENT_INSTRUCTIONS,
  model: AGENT_MODEL,
  tools: launchTools,
  modelSettings: {
    toolChoice: "required",
    parallelToolCalls: true,
    store: false,
    reasoning: { effort: REASONING_EFFORT },
    text: { verbosity: "medium" }
  },
  resetToolChoice: true
});

export const launchRunner = new Runner({
  workflowName: "Launch Desk planning",
  tracingDisabled: TRACING_DISABLED,
  traceIncludeSensitiveData: false,
  toolNotFoundBehavior: "return_error_to_model"
});
