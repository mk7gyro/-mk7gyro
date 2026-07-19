import { launchAgent, launchRunner } from "../src/agent/launch-agent.js";
import { launchTools } from "../src/agent/tools.js";
import { AGENT_MODEL } from "../src/agent/config.js";

if (!launchAgent || !launchRunner) throw new Error("Launch Desk agent or runner was not constructed.");
if (launchTools.length !== 4) throw new Error(`Expected four launch tools, received ${launchTools.length}.`);
console.log(`Agents SDK ready: model=${AGENT_MODEL}, tools=${launchTools.map((tool) => tool.name).join(",")}`);
