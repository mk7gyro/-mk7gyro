const TOOL_LABELS = {
  extract_launch_tasks: "Extracting launch tasks",
  check_launch_readiness: "Checking launch readiness",
  generate_owner_checklists: "Building owner checklists",
  draft_channel_copy: "Drafting channel copy"
};

export function getToolName(item) {
  return item?.rawItem?.name || item?.raw_item?.name || item?.name || item?.toolName || "agent_tool";
}

export function mapAgentEvent(event) {
  if (!event) return [];

  if (event.type === "agent_updated_stream_event") {
    return [{ type: "status", stage: "agent", message: `${event.agent?.name || "Agent"} is working` }];
  }

  if (event.type === "run_item_stream_event") {
    const toolName = getToolName(event.item);
    if (event.name === "tool_called") {
      return [{
        type: "tool_progress",
        tool: toolName,
        phase: "started",
        message: TOOL_LABELS[toolName] || `Running ${toolName}`
      }];
    }
    if (event.name === "tool_output") {
      return [{
        type: "tool_progress",
        tool: toolName,
        phase: "completed",
        message: TOOL_LABELS[toolName] ? `${TOOL_LABELS[toolName]} complete` : `${toolName} complete`
      }];
    }
    return [];
  }

  if (event.type === "raw_model_stream_event") {
    const raw = event.data?.event || event.data;
    if (raw?.type === "response.output_text.delta" || raw?.type === "output_text_delta") {
      const delta = raw.delta || raw.text || "";
      return delta ? [{ type: "text_delta", delta }] : [];
    }
  }

  return [];
}

export function encodeEvent(event) {
  return `${JSON.stringify(event)}\n`;
}
