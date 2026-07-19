const DAY_MS = 86_400_000;

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function has(text, pattern) {
  return pattern.test(text.toLowerCase());
}

export function daysUntilLaunch(launchDate, now = new Date()) {
  const launch = new Date(`${launchDate}T12:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  return Math.ceil((launch - today) / DAY_MS);
}

export function extractTasks(input) {
  const corpus = `${input.productBrief} ${input.constraints} ${input.availableAssets}`.toLowerCase();
  const tasks = [
    { priority: "P0", phase: "Scope", owner: "Product", task: "Freeze the launch scope, success criteria, and explicit non-goals." },
    { priority: "P0", phase: "Quality", owner: "Engineering", task: "Define release-blocking tests and complete the critical-path verification pass." },
    { priority: "P0", phase: "Operations", owner: "Engineering", task: "Document rollout, rollback, monitoring, and incident ownership before release." },
    { priority: "P0", phase: "Readiness", owner: "Launch lead", task: "Run a cross-functional go/no-go review with evidence for every blocker." },
    { priority: "P1", phase: "Enablement", owner: "Product marketing", task: "Finalize the positioning, proof points, FAQs, and channel message hierarchy." },
    { priority: "P1", phase: "Support", owner: "Support", task: "Prepare escalation paths, known-issue responses, and customer-facing support notes." },
    { priority: "P1", phase: "Measurement", owner: "Data", task: "Confirm launch metrics, dashboards, alert thresholds, and the first review date." }
  ];

  if (has(corpus, /api|sdk|developer|integration|webhook/)) {
    tasks.push({ priority: "P0", phase: "Developer experience", owner: "Developer relations", task: "Validate reference docs, examples, migration notes, and a clean-room integration path." });
  }
  if (has(corpus, /security|privacy|compliance|soc 2|gdpr|hipaa|permission|auth/)) {
    tasks.push({ priority: "P0", phase: "Risk", owner: "Security", task: "Complete security, privacy, permissions, and data-handling review with named approvers." });
  }
  if (has(corpus, /mobile|ios|android|app store|play store/)) {
    tasks.push({ priority: "P0", phase: "Distribution", owner: "Mobile", task: "Confirm store submission status, review contingency, phased release settings, and rollback path." });
  }
  if (has(corpus, /migration|breaking|deprecat|legacy/)) {
    tasks.push({ priority: "P0", phase: "Migration", owner: "Engineering", task: "Publish compatibility impact, migration steps, rollback criteria, and customer outreach targets." });
  }
  if (!cleanText(input.availableAssets)) {
    tasks.push({ priority: "P1", phase: "Assets", owner: "Launch lead", task: "Inventory missing launch assets and assign owners before committing to channel dates." });
  }

  return tasks.slice(0, 12);
}

export function assessReadiness(input, now = new Date()) {
  const days = daysUntilLaunch(input.launchDate, now);
  const assets = input.availableAssets.toLowerCase();
  const constraints = input.constraints.toLowerCase();
  const brief = input.productBrief.toLowerCase();
  const checks = [
    { area: "Scope", weight: 20, ready: brief.length >= 120, gap: "Clarify scope, outcome, and non-goals." },
    { area: "Quality evidence", weight: 20, ready: /test|qa|beta|pilot|dogfood|validated/.test(`${brief} ${assets}`), gap: "Add release-blocking test evidence or beta results." },
    { area: "Operational safety", weight: 20, ready: /rollback|rollout|monitor|alert|runbook/.test(`${constraints} ${assets}`), gap: "Define rollout, rollback, monitoring, and on-call ownership." },
    { area: "Customer enablement", weight: 15, ready: /docs|faq|support|guide|release note/.test(assets), gap: "Prepare documentation, FAQ, support notes, or release notes." },
    { area: "Go-to-market assets", weight: 15, ready: /copy|email|landing|demo|video|screenshot|creative/.test(assets), gap: "Confirm channel copy and core launch creative." },
    { area: "Schedule", weight: 10, ready: days >= 7, gap: days < 0 ? "The launch date is in the past." : "Allow at least seven days for cross-functional readiness." }
  ];
  const score = checks.reduce((sum, check) => sum + (check.ready ? check.weight : 0), 0);
  const blockers = checks.filter((check) => !check.ready && check.weight >= 20).map((check) => check.gap);
  const gaps = checks.filter((check) => !check.ready).map((check) => ({ area: check.area, action: check.gap }));
  const posture = score >= 85 ? "ready with routine controls" : score >= 65 ? "conditional go" : score >= 45 ? "at risk" : "not ready";
  return { score, posture, daysUntilLaunch: days, blockers, gaps, checks };
}

export function buildOwnerChecklist(input) {
  const date = input.launchDate;
  return [
    { owner: "Launch lead", items: [`Own the integrated plan through ${date}.`, "Publish decision log and go/no-go criteria.", "Confirm every P0 has an owner and due date."] },
    { owner: "Engineering", items: ["Complete release-blocking verification.", "Prepare staged rollout and rollback commands.", "Staff monitoring and incident response coverage."] },
    { owner: "Product", items: ["Freeze scope and customer promise.", "Approve known limitations and exclusions.", "Confirm success metrics and review cadence."] },
    { owner: "Product marketing", items: ["Approve message hierarchy and claims.", "Adapt copy to selected channels.", "Coordinate announcement timing and asset delivery."] },
    { owner: "Support / Success", items: ["Review known issues and FAQ.", "Prepare escalation routing.", "Identify customers needing proactive outreach."] }
  ];
}

export function createChannelCopyBriefs(input) {
  const product = cleanText(input.productBrief).split(/[.!?]/)[0].slice(0, 180);
  const audience = cleanText(input.audience).slice(0, 140);
  const specs = {
    "Release notes": { format: "What changed / why it matters / how to start", limit: "120–220 words", cta: "Read the migration or usage guide" },
    "Email": { format: "Outcome-led subject, proof, 3 bullets, direct CTA", limit: "90–160 words", cta: "Try the release or book a walkthrough" },
    "LinkedIn": { format: "Strong opening, customer tension, release value, concise proof", limit: "80–140 words", cta: "Read the launch post" },
    "X / Twitter": { format: "Single clear claim plus one proof point", limit: "220 characters", cta: "Open the launch link" },
    "In-app": { format: "Benefit headline, one sentence, action", limit: "35–60 words", cta: "Explore now" },
    "Developer community": { format: "Problem, technical change, example, limitations", limit: "150–300 words", cta: "Read docs and share feedback" },
    "Docs": { format: "Overview, prerequisites, steps, limitations, rollback", limit: "Task-oriented", cta: "Complete the quickstart" },
    "Product Hunt": { format: "Plain-language promise, maker context, capabilities", limit: "120–200 words", cta: "Try it and leave feedback" }
  };
  return input.channels.map((channel) => ({
    channel,
    audience,
    coreClaimSeed: product,
    tone: input.tone,
    ...specs[channel]
  }));
}

export function summarizeToolData(name, data) {
  if (name === "extract_launch_tasks") return `${data.length} prioritized work items extracted`;
  if (name === "check_launch_readiness") return `Readiness ${data.score}/100 · ${data.posture}`;
  if (name === "generate_owner_checklists") return `${data.length} owner groups prepared`;
  if (name === "draft_channel_copy") return `${data.length} channel copy briefs prepared`;
  return "Tool completed";
}
