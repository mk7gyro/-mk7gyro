const normalize = (value) => String(value || "").trim();
const splitList = (value) => normalize(value).split(/\n|,|;/).map((item) => item.trim()).filter(Boolean);

export function validateLaunchInput(input) {
  const data = {
    brief: normalize(input?.brief),
    audience: normalize(input?.audience),
    launchDate: normalize(input?.launchDate),
    constraints: normalize(input?.constraints),
    assets: normalize(input?.assets)
  };
  const errors = [];
  if (data.brief.length < 20) errors.push("Product brief must be at least 20 characters.");
  if (data.audience.length < 3) errors.push("Audience is required.");
  if (data.brief.length > 8000) errors.push("Product brief is too long.");
  if ([data.audience, data.constraints, data.assets].some((value) => value.length > 4000)) errors.push("One or more fields are too long.");
  return { ok: errors.length === 0, data, errors };
}

export function extractLaunchTasks(input) {
  const constraints = splitList(input.constraints);
  const assets = splitList(input.assets);
  const dateLabel = input.launchDate || "launch date TBD";
  const tasks = [
    { priority: "P0", workstream: "Scope", task: "Confirm launch promise, target user, success metric, and non-goals.", ownerRole: "Product", timing: "Immediately" },
    { priority: "P0", workstream: "Engineering", task: "Define release candidate, rollback path, monitoring, and launch-day support coverage.", ownerRole: "Engineering", timing: `Before ${dateLabel}` },
    { priority: "P0", workstream: "Readiness", task: "Run acceptance, security, privacy, and operational readiness checks.", ownerRole: "Engineering + Security", timing: "Before go/no-go" },
    { priority: "P1", workstream: "Messaging", task: `Translate the product value for ${input.audience || "the target audience"} into one primary message and three proof points.`, ownerRole: "Product Marketing", timing: "Before copy review" },
    { priority: "P1", workstream: "Enablement", task: "Prepare support notes, internal FAQ, demo flow, and escalation contacts.", ownerRole: "Support + Sales", timing: "Before internal enablement" },
    { priority: "P1", workstream: "Measurement", task: "Instrument adoption, activation, reliability, and feedback signals; assign dashboard owners.", ownerRole: "Data", timing: "Before launch" },
    { priority: "P2", workstream: "Follow-through", task: "Schedule 24-hour, 7-day, and 30-day launch reviews with explicit decision criteria.", ownerRole: "Launch Lead", timing: "Before launch" }
  ];
  if (!input.launchDate) tasks.unshift({ priority: "P0", workstream: "Decision", task: "Set a target launch date or define the milestone that determines it.", ownerRole: "Launch Lead", timing: "Immediately" });
  if (constraints.length) tasks.push({ priority: "P1", workstream: "Constraints", task: `Resolve or explicitly accept: ${constraints.join("; ")}.`, ownerRole: "Launch Lead", timing: "Before go/no-go" });
  return { tasks, assetCount: assets.length, constraintCount: constraints.length };
}

export function checkLaunchReadiness(input) {
  const checks = [
    ["Strategy", Boolean(input.brief && input.audience), "Clear product promise and audience"],
    ["Timing", Boolean(input.launchDate), "Launch date or gating milestone"],
    ["Constraints", Boolean(input.constraints), "Known constraints and explicit tradeoffs"],
    ["Assets", Boolean(input.assets), "Available launch assets and gaps"],
    ["Operations", /rollback|monitor|support|on-call|incident/i.test(input.brief + " " + input.constraints), "Rollback, monitoring, and support coverage"],
    ["Measurement", /metric|kpi|success|adoption|activation|conversion/i.test(input.brief), "Success metrics and measurement owner"],
    ["Risk", /risk|security|privacy|legal|compliance/i.test(input.brief + " " + input.constraints), "Security, privacy, legal, or compliance review"]
  ];
  const passed = checks.filter(([, value]) => value).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    score,
    status: score >= 80 ? "ready_with_monitoring" : score >= 55 ? "conditional" : "not_ready",
    dimensions: checks.map(([name, value, criterion]) => ({ name, ready: value, criterion })),
    missing: checks.filter(([, value]) => !value).map(([, , criterion]) => criterion)
  };
}

export function generateOwnerChecklist(input) {
  return {
    launchDate: input.launchDate || "TBD",
    owners: [
      { role: "Launch Lead", items: ["Own decision log and critical path", "Schedule go/no-go", "Confirm launch-day command channel"] },
      { role: "Engineering", items: ["Freeze release candidate", "Verify rollback and feature flags", "Confirm dashboards and alerts", "Publish support runbook"] },
      { role: "Product", items: ["Approve scope and non-goals", "Confirm target audience", "Define success metrics"] },
      { role: "Marketing / Comms", items: ["Approve narrative and proof points", "Finalize channel copy", "Coordinate publication timing"] },
      { role: "Support / Success", items: ["Review FAQ", "Prepare macros and escalation path", "Brief customer-facing teams"] },
      { role: "Data", items: ["Validate event instrumentation", "Publish launch dashboard", "Schedule post-launch readout"] }
    ]
  };
}

export function draftLaunchCopy(input) {
  const product = normalize(input.brief).split(/[.!?\n]/)[0].slice(0, 180) || "the new product experience";
  const audience = input.audience || "teams";
  return {
    internalSlack: `Launch Desk draft: We’re preparing to launch ${product}. The release is designed for ${audience}. Today’s focus is readiness: owners, risks, rollback, support coverage, and the final message.`,
    customerEmail: {
      subject: `A new way to ${audience.toLowerCase().includes("developer") ? "ship with confidence" : "move faster"}`,
      body: `We’re introducing ${product}. It is built for ${audience} and focuses on a clearer path from first use to measurable value. We’ll share availability, setup guidance, and support details as the launch approaches.`
    },
    social: `Coming soon: ${product}. Built with ${audience} in mind—clearer value, a focused rollout, and a launch plan designed for reliable adoption.`,
    changelog: `New: ${product}. Includes launch guidance, operational readiness, owner checklists, and channel-ready messaging.`
  };
}

export function formatAgentInput(input) {
  return `Create a launch plan from this intake.\n\nPRODUCT BRIEF\n${input.brief}\n\nAUDIENCE\n${input.audience}\n\nTARGET LAUNCH DATE\n${input.launchDate || "Not provided"}\n\nCONSTRAINTS\n${input.constraints || "Not provided"}\n\nAVAILABLE ASSETS\n${input.assets || "Not provided"}`;
}
