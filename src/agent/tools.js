import { tool } from "@openai/agents";
import {
  taskExtractionSchema,
  readinessSchema,
  ownerChecklistSchema,
  channelCopySchema
} from "./schemas.js";

function sentenceFragments(value) {
  return String(value || "")
    .split(/[\n.;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 5);
}

export function extractTasks({ productBrief, launchDate, constraints = "" }) {
  const briefSignals = sentenceFragments(productBrief).slice(0, 4);
  const constraintSignals = sentenceFragments(constraints).slice(0, 3);
  const tasks = [
    { priority: "P0", workstream: "Release", task: "Define launch scope, success criteria, and explicit non-goals.", rationale: "Prevents scope drift." },
    { priority: "P0", workstream: "Engineering", task: "Lock the release candidate and complete critical-path verification.", rationale: `Protects the ${launchDate} target.` },
    { priority: "P0", workstream: "Operations", task: "Write rollback, incident ownership, and launch-day escalation procedures.", rationale: "Reduces operational ambiguity." },
    { priority: "P1", workstream: "Enablement", task: "Prepare support, sales, and internal stakeholder briefing materials.", rationale: "Aligns customer-facing teams." },
    { priority: "P1", workstream: "Measurement", task: "Instrument launch health, adoption, and failure signals.", rationale: "Makes launch quality observable." },
    { priority: "P1", workstream: "Communications", task: "Approve channel copy, screenshots, and release notes.", rationale: "Avoids last-minute approval blocks." }
  ];

  briefSignals.forEach((signal, index) => {
    tasks.push({
      priority: index < 2 ? "P0" : "P1",
      workstream: "Product",
      task: `Validate delivery requirement: ${signal}`,
      rationale: "Derived from the supplied product brief."
    });
  });

  constraintSignals.forEach((signal) => {
    tasks.push({
      priority: "P0",
      workstream: "Constraint",
      task: `Resolve or explicitly accept constraint: ${signal}`,
      rationale: "Constraint is material to launch readiness."
    });
  });

  return {
    launchDate,
    tasks: tasks.slice(0, 14),
    sourceSignals: { brief: briefSignals, constraints: constraintSignals }
  };
}

function includesAny(value, terms) {
  const normalized = String(value || "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function scoreReadiness({ productBrief, audience, launchDate, constraints = "", assets = "" }) {
  const checks = [
    {
      id: "scope",
      label: "Scope and outcome",
      weight: 20,
      passed: productBrief.length >= 80,
      evidence: productBrief.length >= 80 ? "Brief includes meaningful product context." : "Brief needs clearer scope and intended outcome."
    },
    {
      id: "audience",
      label: "Audience definition",
      weight: 15,
      passed: audience.length >= 20,
      evidence: audience.length >= 20 ? "Audience is specific enough to guide messaging." : "Audience is too broad."
    },
    {
      id: "date",
      label: "Launch timing",
      weight: 15,
      passed: Boolean(launchDate && launchDate.length >= 4),
      evidence: launchDate ? `Target supplied: ${launchDate}.` : "No target date supplied."
    },
    {
      id: "quality",
      label: "Quality and rollback",
      weight: 20,
      passed: includesAny(constraints + " " + assets, ["test", "qa", "rollback", "runbook", "monitor"]),
      evidence: includesAny(constraints + " " + assets, ["test", "qa", "rollback", "runbook", "monitor"])
        ? "Quality, monitoring, or rollback evidence is present."
        : "No test, monitoring, runbook, or rollback evidence supplied."
    },
    {
      id: "communications",
      label: "Launch communications",
      weight: 15,
      passed: includesAny(assets, ["copy", "release note", "email", "blog", "screenshot", "demo"]),
      evidence: includesAny(assets, ["copy", "release note", "email", "blog", "screenshot", "demo"])
        ? "At least one communications asset is available."
        : "No communications asset is listed."
    },
    {
      id: "ownership",
      label: "Owners and escalation",
      weight: 15,
      passed: includesAny(constraints + " " + assets, ["owner", "dri", "on-call", "support", "approver"]),
      evidence: includesAny(constraints + " " + assets, ["owner", "dri", "on-call", "support", "approver"])
        ? "Ownership or escalation evidence is present."
        : "No owner, approver, or escalation path is visible."
    }
  ];

  const score = checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0);
  const blockers = checks.filter((check) => !check.passed && check.weight >= 15).map((check) => check.evidence);
  return {
    score,
    status: score >= 80 ? "ready" : score >= 55 ? "conditional" : "not_ready",
    checks,
    blockers
  };
}

export function buildOwnerChecklist({ launchDate, tasks, assets = "" }) {
  const owners = ["Engineering", "Product", "Design", "Marketing", "Support", "Data"];
  const normalizedTasks = tasks.slice(0, 12);
  return {
    launchDate,
    checklist: normalizedTasks.map((task, index) => ({
      owner: owners[index % owners.length],
      priority: index < 4 ? "P0" : index < 9 ? "P1" : "P2",
      item: task,
      due: index < 4 ? "Before code freeze" : index < 9 ? "Before launch rehearsal" : "Launch week",
      acceptance: `Evidence attached and acknowledged by ${owners[index % owners.length]}`
    })),
    assetNote: assets
      ? "Available assets should be linked directly from checklist items."
      : "No assets were supplied; assign an owner to create the minimum launch packet."
  };
}

export function buildChannelCopy({ productSummary, audience, channels, tone = "clear, credible, and concise" }) {
  const shortProduct = productSummary.replace(/\s+/g, " ").trim().slice(0, 220);
  const templates = {
    release_notes: {
      headline: "Now available: a clearer path from release to result",
      body: `${shortProduct} This release is designed for ${audience}. Review the setup notes, known constraints, and rollout guidance before enabling it.`
    },
    email: {
      subject: "A focused new release for your team",
      body: `${shortProduct}\n\nBuilt for ${audience}, the launch emphasizes a practical path to first value, with clear rollout guidance and support.`
    },
    social: {
      post: `${shortProduct} Built for ${audience}. The release is shipping with a measured rollout, clear documentation, and a feedback loop for what comes next.`
    },
    in_product: {
      title: "A new capability is ready",
      body: `Explore ${shortProduct}. Start with the guided setup and share feedback with the launch team.`
    }
  };

  return {
    tone,
    drafts: channels.map((channel) => ({ channel, ...templates[channel] })),
    claimPolicy: "Drafts intentionally avoid metrics or customer claims not supplied in the brief."
  };
}

export const extractLaunchTasksTool = tool({
  name: "extract_launch_tasks",
  description: "Extract concrete engineering and launch work from a rough product brief. Use early to establish the work breakdown.",
  parameters: taskExtractionSchema,
  async execute(input) {
    return JSON.stringify(extractTasks(input));
  }
});

export const checkLaunchReadinessTool = tool({
  name: "check_launch_readiness",
  description: "Score launch readiness against a deterministic rubric covering scope, audience, timing, quality, communications, and ownership.",
  parameters: readinessSchema,
  async execute(input) {
    return JSON.stringify(scoreReadiness(input));
  }
});

export const generateOwnerChecklistTool = tool({
  name: "generate_owner_checklist",
  description: "Turn launch tasks into an owner-oriented checklist with priority, timing, and acceptance evidence.",
  parameters: ownerChecklistSchema,
  async execute(input) {
    return JSON.stringify(buildOwnerChecklist(input));
  }
});

export const draftChannelCopyTool = tool({
  name: "draft_channel_copy",
  description: "Draft restrained, channel-specific launch copy without inventing unsupported claims.",
  parameters: channelCopySchema,
  async execute(input) {
    return JSON.stringify(buildChannelCopy(input));
  }
});

export const launchTools = [
  extractLaunchTasksTool,
  checkLaunchReadinessTool,
  generateOwnerChecklistTool,
  draftChannelCopyTool
];
