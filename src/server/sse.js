export function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function extractTextDelta(event) {
  if (event?.type !== "raw_model_stream_event") return "";
  const data = event.data || {};
  if (data.type === "output_text_delta") return data.delta || "";
  if (data.event?.type === "response.output_text.delta") return data.event.delta || "";
  return "";
}

export function toolEventName(event) {
  if (event?.type !== "run_item_stream_event") return null;
  if (event.name === "tool_called") return "tool.started";
  if (event.name === "tool_output") return "tool.completed";
  return null;
}

export function toolLabel(event) {
  const item = event?.item || {};
  return item.rawItem?.name || item.name || item.tool?.name || item.rawItem?.call_id || "launch_tool";
}
