import test from "node:test";
import assert from "node:assert/strict";
import { validateCampaignInput, validateImageRequest } from "../src/campaign/schemas.js";

const validInput = {
  brief: "Launch a shared research workspace for product teams this quarter.",
  audience: "Product managers and UX researchers",
  productDetails: "Imports notes, links evidence to decisions, and creates source-backed summaries.",
  tone: "Confident, clear, and modern",
  channels: ["Landing page", "Email", "LinkedIn"]
};

test("accepts a complete campaign brief", () => {
  const result = validateCampaignInput(validInput);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.channels, validInput.channels);
});

test("rejects a campaign without channels", () => {
  const result = validateCampaignInput({ ...validInput, channels: [] });
  assert.equal(result.ok, false);
});

test("accepts a bounded image request", () => {
  const result = validateImageRequest({
    campaignName: "Evidence, in motion",
    tone: validInput.tone,
    audience: validInput.audience,
    imageDirections: [
      {
        title: "Signal wall",
        prompt: "Editorial campaign key art showing luminous evidence cards converging into one clear product decision, warm studio light, premium composition, no text or logos.",
        altText: "Research evidence cards converging into a clear decision."
      }
    ]
  });
  assert.equal(result.ok, true);
});
