import test from "node:test";
import assert from "node:assert/strict";
import { encodeEvent, mapAgentEvent } from "../src/agent/stream.js";

test("maps a tool call to a progress event", () => {
  const events = mapAgentEvent({
    type: "run_item_stream_event",
    name: "tool_called",
    item: { rawItem: { name: "check_launch_readiness" } }
  });
  assert.equal(events[0].type, "tool_progress");
  assert.equal(events[0].tool, "check_launch_readiness");
});

test("maps a Responses text delta", () => {
  const events = mapAgentEvent({
    type: "raw_model_stream_event",
    data: { event: { type: "response.output_text.delta", delta: "Launch" } }
  });
  assert.deepEqual(events, [{ type: "text_delta", delta: "Launch" }]);
});

test("encodes newline-delimited JSON", () => {
  const value = encodeEvent({ type: "status", message: "ok" });
  assert.ok(value.endsWith("\n"));
  assert.equal(JSON.parse(value).message, "ok");
});
