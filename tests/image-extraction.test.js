import test from "node:test";
import assert from "node:assert/strict";
import { extractImageResult } from "../src/campaign/openai.js";

test("extracts a Responses image generation result", () => {
  const result = extractImageResult({
    output: [
      { type: "reasoning", id: "reasoning_1" },
      { type: "image_generation_call", id: "image_1", result: "ZmFrZS1wbmc=" }
    ]
  });
  assert.equal(result, "ZmFrZS1wbmc=");
});

test("returns null when no image call completed", () => {
  assert.equal(extractImageResult({ output: [{ type: "message" }] }), null);
  assert.equal(extractImageResult(null), null);
});
