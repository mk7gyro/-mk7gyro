const allowedEfforts = new Set(["none", "low", "medium", "high"]);

export const AGENT_MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra";
export const REASONING_EFFORT = allowedEfforts.has(process.env.LAUNCH_DESK_REASONING_EFFORT)
  ? process.env.LAUNCH_DESK_REASONING_EFFORT
  : "low";
