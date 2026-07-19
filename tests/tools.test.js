import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTasks,
  scoreReadiness,
  buildOwnerChecklist,
  buildChannelCopy
} from "../src/agent/tools.js";

test("task extraction emits prioritized launch work", () => {
  const result = extractTasks({
    productBrief: "Ship a beta with audit history. Add guided setup. Measure activation.",
    launchDate: "2026-08-15",
    constraints: "Security review required."
  });
  assert.ok(result.tasks.length >= 6);
  assert.equal(result.tasks[0].priority, "P0");
});

test("readiness rubric exposes blockers", () => {
  const result = scoreReadiness({
    productBrief: "A short beta description with a clear intended result for engineering teams.",
    audience: "Engineering teams",
    launchDate: "2026-08-15",
    constraints: "",
    assets: ""
  });
  assert.ok(result.score <= 100);
  assert.ok(result.blockers.length >= 1);
});

test("owner checklist assigns role, priority, timing, and evidence", () => {
  const result = buildOwnerChecklist({
    launchDate: "2026-08-15",
    tasks: ["Complete QA", "Approve rollback", "Draft release notes"],
    assets: "QA plan"
  });
  assert.equal(result.checklist.length, 3);
  assert.ok(result.checklist.every((item) => item.owner && item.acceptance));
});

test("channel copy remains bounded to requested channels", () => {
  const result = buildChannelCopy({
    productSummary: "A release coordination workspace that links rollout evidence and owner decisions.",
    audience: "engineering teams",
    channels: ["email", "in_product"],
    tone: "direct"
  });
  assert.deepEqual(result.drafts.map((item) => item.channel), ["email", "in_product"]);
});
