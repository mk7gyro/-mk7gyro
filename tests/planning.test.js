import test from "node:test";
import assert from "node:assert/strict";
import { validateLaunchInput, extractLaunchTasks, checkLaunchReadiness, generateOwnerChecklist, draftLaunchCopy } from "../src/core/planning.js";

const intake = {
  brief: "Launch a developer platform feature with metrics, rollback, monitoring, security review, and a documented support plan.",
  audience: "Platform engineers",
  launchDate: "2026-09-15",
  constraints: "Security review; two engineers",
  assets: "Demo; docs; beta quote"
};

test("validates complete intake", () => assert.equal(validateLaunchInput(intake).ok, true));
test("extracts prioritized tasks", () => assert.ok(extractLaunchTasks(intake).tasks.some((task) => task.priority === "P0" && task.ownerRole)));
test("scores readiness dimensions", () => {
  const readiness = checkLaunchReadiness(intake);
  assert.ok(readiness.score >= 70);
  assert.equal(readiness.dimensions.length, 7);
});
test("builds role-based checklists", () => assert.ok(generateOwnerChecklist(intake).owners.some((owner) => owner.role === "Engineering")));
test("drafts multiple channels", () => {
  const copy = draftLaunchCopy(intake);
  assert.ok(copy.internalSlack && copy.customerEmail.subject && copy.social && copy.changelog);
});
