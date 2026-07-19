import { launchAgent, launchRunner } from "../src/agent/launch-agent.js";
import { AGENT_MODEL } from "../src/agent/config.js";

if (!launchAgent || !launchRunner) throw new Error("Agent or runner did not initialize.");
if (launchAgent.tools.length !== 4) throw new Error(`Expected 4 tools, found ${launchAgent.tools.length}.`);
if (!launchAgent.tools.every((tool) => tool.type === "function")) throw new Error("All Launch Desk tools must be function tools.");
console.log(`Agents SDK ready: model=${AGENT_MODEL}, tools=${launchAgent.tools.map((tool) => tool.name).join(",")}`);
