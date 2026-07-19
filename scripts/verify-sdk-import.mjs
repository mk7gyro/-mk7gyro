import { launchDeskAgent, launchRunner, MODEL } from "../src/agent/launch-agent.js";

if (!launchDeskAgent || !launchRunner || !MODEL) {
  throw new Error("Agents SDK configuration did not load.");
}

console.log(`Agents SDK configuration loaded for ${MODEL}.`);
