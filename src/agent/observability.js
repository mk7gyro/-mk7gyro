let attached = false;

export function attachObservability(runner) {
  if (attached || !runner?.on) return;
  attached = true;

  runner.on("agent_start", (_context, agent) => {
    console.info("launch_desk.agent_start", { agent: agent?.name });
  });

  runner.on("agent_tool_start", (_context, agent, tool) => {
    console.info("launch_desk.tool_start", { agent: agent?.name, tool: tool?.name });
  });

  runner.on("agent_tool_end", (_context, agent, tool) => {
    console.info("launch_desk.tool_end", { agent: agent?.name, tool: tool?.name });
  });

  runner.on("agent_end", (_context, agent) => {
    console.info("launch_desk.agent_end", { agent: agent?.name });
  });
}
