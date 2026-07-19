function rawPayload(event) {
  return event?.data?.event || event?.data || null;
}

export function toolNameFromItem(item) {
  return item?.rawItem?.name
    || item?.rawItem?.function?.name
    || item?.name
    || item?.tool?.name
    || "agent_tool";
}

export function mapAgentStreamEvent(event) {
  if (!event || typeof event !== "object") return [];

  if (event.type === "agent_updated_stream_event") {
    return [{ type: "agent", name: event.agent?.name || "Launch Desk" }];
  }

  if (event.type === "run_item_stream_event") {
    if (event.name === "tool_called") {
      return [{
        type: "tool_progress",
        status: "started",
        tool: toolNameFromItem(event.item)
      }];
    }
    if (event.name === "tool_output") {
      return [{
        type: "tool_progress",
        status: "completed",
        tool: toolNameFromItem(event.item)
      }];
    }
    return [];
  }

  if (event.type === "raw_model_stream_event") {
    const raw = rawPayload(event);
    if (
      raw?.type === "response.output_text.delta"
      || raw?.type === "output_text_delta"
    ) {
      const delta = typeof raw.delta === "string" ? raw.delta : "";
      return delta ? [{ type: "text_delta", delta }] : [];
    }
  }

  return [];
}
