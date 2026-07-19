import test from "node:test";
import assert from "node:assert/strict";
import { mapAgentStreamEvent } from "../src/agent/stream-events.js";

test("maps a tool call into a progress event", () => {
  const mapped = mapAgentStreamEvent({
    type: "run_item_stream_event",
    name: "tool_called",
    item: { rawItem: { name: "check_launch_readiness" } }
  });
  assert.deepEqual(mapped, [{
    type: "tool_progress",
    status: "started",
    tool: "check_launch_readiness"
  }]);
});

test("maps an OpenAI Responses text delta", () => {
  const mapped = mapAgentStreamEvent({
    type: "raw_model_stream_event",
    data: { event: { type: "response.output_text.delta", delta: "Launch" } }
  });
  assert.deepEqual(mapped, [{ type: "text_delta", delta: "Launch" }]);
});

test("ignores unrelated stream events", () => {
  assert.deepEqual(mapAgentStreamEvent({ type: "raw_model_stream_event", data: { event: { type: "response.created" } } }), []);
});
