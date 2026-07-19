import test from "node:test";
import assert from "node:assert/strict";
import { buildWorldInstructions } from "../src/realtime/instructions.js";

test("world instructions preserve the supplied seed and spoken-turn constraints", () => {
  const value = buildWorldInstructions({ worldSeed: "A forest that remembers every visitor.", style: "Dark folklore" });
  assert.match(value, /forest that remembers/);
  assert.match(value, /Dark folklore/);
  assert.match(value, /2-5 sentences/);
  assert.match(value, /one focused question/);
});
