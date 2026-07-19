import test from "node:test";
import assert from "node:assert/strict";
import { extractTextDelta, toolEventName } from "../src/server/sse.js";

test("extracts generic text delta", () => assert.equal(extractTextDelta({ type: "raw_model_stream_event", data: { type: "output_text_delta", delta: "Hi" } }), "Hi"));
test("maps tool lifecycle events", () => {
  assert.equal(toolEventName({ type: "run_item_stream_event", name: "tool_called" }), "tool.started");
  assert.equal(toolEventName({ type: "run_item_stream_event", name: "tool_output" }), "tool.completed");
});
