import test from "node:test";
import assert from "node:assert/strict";
import { assessReadiness, buildOwnerChecklist, createChannelCopyBriefs, extractTasks } from "../src/core/planning.js";

const input = {
  productBrief: "Launch a developer API beta with SDK examples, trace search, and source-linked diagnostics. Beta testing is complete.",
  audience: "Platform engineers",
  launchDate: "2026-08-15",
  constraints: "Security approval required. Staged rollout and rollback flag are ready. Monitoring alerts exist.",
  availableAssets: "API docs, quickstart, demo, screenshots, support FAQ, release notes, dashboard, beta feedback.",
  tone: "Technical and clear",
  channels: ["Docs", "Developer community", "Email"]
};

test("extracts bounded prioritized tasks", () => {
  const tasks = extractTasks(input);
  assert.ok(tasks.length >= 7 && tasks.length <= 12);
  assert.ok(tasks.some((task) => task.priority === "P0"));
  assert.ok(tasks.some((task) => task.owner === "Security"));
});

test("scores readiness and returns gaps", () => {
  const result = assessReadiness(input, new Date("2026-07-19T00:00:00Z"));
  assert.ok(result.score >= 70);
  assert.equal(typeof result.posture, "string");
  assert.ok(Array.isArray(result.gaps));
});

test("creates role checklists", () => {
  const groups = buildOwnerChecklist(input);
  assert.ok(groups.length >= 5);
  assert.ok(groups.every((group) => group.items.length >= 3));
});

test("creates one copy brief per selected channel", () => {
  const briefs = createChannelCopyBriefs(input);
  assert.equal(briefs.length, input.channels.length);
  assert.deepEqual(briefs.map((item) => item.channel), input.channels);
});
