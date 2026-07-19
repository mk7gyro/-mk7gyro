import test from "node:test";
import assert from "node:assert/strict";
import { campaignPlanSchema } from "../src/campaign/schemas.js";

const fixture = {
  concept: {
    name: "Evidence, in motion",
    oneLiner: "Turn scattered research into decisions the whole team can trust.",
    bigIdea: "Make evidence visible at the moment a product decision is made.",
    audienceInsight: "Growing product teams do not lack research; they lack a shared path from evidence to action.",
    keyMessage: "Every decision can show its work.",
    visualDirection: "Editorial systems imagery with luminous evidence fragments resolving into a calm, legible center."
  },
  copyVariants: [
    { label: "Clarity", headline: "Every decision can show its work.", body: "Bring research evidence into one shared workspace and keep the source attached to the decision.", cta: "See the beta" },
    { label: "Momentum", headline: "Research that moves with the roadmap.", body: "Turn interviews and support notes into traceable insights your team can use now.", cta: "Build with evidence" },
    { label: "Alignment", headline: "One place for what customers actually said.", body: "Give product, design, and leadership a shared evidence layer without another reporting ritual.", cta: "Explore the workspace" }
  ],
  checklist: [
    { phase: "Foundation", item: "Approve the campaign claim hierarchy.", owner: "Product Marketing", priority: "P0" },
    { phase: "Foundation", item: "Confirm beta access and eligibility language.", owner: "Product", priority: "P0" },
    { phase: "Production", item: "Build the landing page and proof-point modules.", owner: "Web", priority: "P0" },
    { phase: "Production", item: "Create email and LinkedIn variants.", owner: "Lifecycle Marketing", priority: "P1" },
    { phase: "Launch", item: "Coordinate in-product and support messaging.", owner: "Customer Success", priority: "P1" },
    { phase: "Measurement", item: "Define activation and qualified-interest signals.", owner: "Growth Analytics", priority: "P1" }
  ],
  imageDirections: [
    { title: "Signal wall", prompt: "Premium editorial campaign key art with luminous research fragments converging into one calm decision plane, warm directional lighting, coral and lilac palette, no text, logos, or interface screenshots.", altText: "Research fragments converging into a clear decision plane." },
    { title: "Thread to truth", prompt: "Conceptual campaign image of many fine colored threads resolving into one confident path across a dark studio environment, refined materials, dramatic soft light, generous negative space, no text or logos.", altText: "Colored threads resolving into one clear path." }
  ],
  assumptions: ["No approved customer metrics or testimonials are currently available."]
};

test("accepts the expected campaign output contract", () => {
  const result = campaignPlanSchema.safeParse(fixture);
  assert.equal(result.success, true);
});

test("requires exactly three copy variants", () => {
  const result = campaignPlanSchema.safeParse({ ...fixture, copyVariants: fixture.copyVariants.slice(0, 2) });
  assert.equal(result.success, false);
});

test("requires exactly two image directions", () => {
  const result = campaignPlanSchema.safeParse({ ...fixture, imageDirections: fixture.imageDirections.slice(0, 1) });
  assert.equal(result.success, false);
});
