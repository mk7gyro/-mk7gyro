const allowedEffort = new Set(["none", "low", "medium", "high", "xhigh", "max"]);

export const AGENT_MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra";
export const REASONING_EFFORT = allowedEffort.has(process.env.OPENAI_AGENT_REASONING_EFFORT)
  ? process.env.OPENAI_AGENT_REASONING_EFFORT
  : "low";
export const TRACING_DISABLED = process.env.OPENAI_AGENTS_DISABLE_TRACING === "1";
