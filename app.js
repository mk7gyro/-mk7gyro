const $ = (selector) => document.querySelector(selector);

const form = $("#launchForm");
const runButton = $("#runButton");
const cancelButton = $("#cancelButton");
const sampleButton = $("#sampleButton");
const retryButton = $("#retryButton");
const copyButton = $("#copyButton");
const emptyState = $("#emptyState");
const workingState = $("#workingState");
const errorState = $("#errorState");
const results = $("#results");
const timeline = $("#timeline");
const answerText = $("#answerText");
const runMeta = $("#runMeta");
const deskTitle = $("#deskTitle");
const status = $("#status");
const statusText = $("#statusText");
const workingTitle = $("#workingTitle");
const workingText = $("#workingText");
const toast = $("#toast");

let controller = null;
let lastPayload = null;
let finalPlan = "";
let runStats = { toolEvents: 0, textDeltas: 0 };

function setPanel(name) {
  emptyState.hidden = name !== "empty";
  workingState.hidden = name !== "working";
  errorState.hidden = name !== "error";
  results.hidden = name !== "results";
}

function setStatus(state, label) {
  status.dataset.state = state;
  statusText.textContent = label;
}

function setStage(name, state, label) {
  const node = document.querySelector(`[data-stage="${name}"]`);
  if (!node) return;
  node.dataset.state = state;
  node.querySelector("small").textContent = label;
}

function resetStages() {
  ["intake", "tools", "plan"].forEach((name) => setStage(name, "waiting", "Waiting"));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setWorking(working) {
  runButton.disabled = working;
  sampleButton.disabled = working;
  cancelButton.hidden = !working;
  form.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = working;
  });
}

function payloadFromForm() {
  const mode = $("#launchMode").value;
  const constraints = $("#constraints").value.trim();
  return {
    productBrief: $("#productBrief").value.trim(),
    audience: $("#audience").value.trim(),
    launchDate: $("#launchDate").value.trim(),
    constraints: [constraints, `Launch mode: ${mode}`].filter(Boolean).join("\n"),
    assets: $("#assets").value.trim()
  };
}

function addTimeline(label, detail, state = "active") {
  const row = document.createElement("article");
  row.dataset.state = state;
  const dot = document.createElement("span");
  const copy = document.createElement("div");
  const strong = document.createElement("strong");
  const small = document.createElement("small");
  strong.textContent = label;
  small.textContent = detail;
  copy.append(strong, small);
  row.append(dot, copy);
  timeline.append(row);
  row.scrollIntoView({ block: "nearest" });
}

function friendlyToolName(name) {
  return String(name || "agent_tool")
    .replace(/^.*\./, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function processEvent(event) {
  if (event.type === "meta") {
    runMeta.textContent = `Request ${event.requestId} · ${event.model} · tracing ${event.tracing}`;
    addTimeline("Agent connected", `Model: ${event.model}`, "complete");
    return;
  }

  if (event.type === "agent") {
    addTimeline("Agent active", event.name, "complete");
    return;
  }

  if (event.type === "tool_progress") {
    runStats.toolEvents += 1;
    setPanel("results");
    setStage("intake", "done", "Complete");
    setStage("tools", "active", "Analyzing");
    setStatus("working", "Running launch tools");
    const tool = friendlyToolName(event.tool);
    addTimeline(
      event.status === "started" ? `${tool} started` : `${tool} completed`,
      event.status === "started" ? "The agent requested structured analysis." : "Tool evidence returned to the agent.",
      event.status === "started" ? "active" : "complete"
    );
    return;
  }

  if (event.type === "text_delta") {
    runStats.textDeltas += 1;
    setPanel("results");
    setStage("tools", "done", `${runStats.toolEvents} events`);
    setStage("plan", "active", "Streaming");
    setStatus("working", "Writing release plan");
    answerText.textContent += event.delta;
    answerText.scrollIntoView({ block: "end" });
    return;
  }

  if (event.type === "complete") {
    finalPlan = event.finalOutput || answerText.textContent;
    if (!answerText.textContent && finalPlan) answerText.textContent = finalPlan;
    setStage("tools", "done", `${event.toolEvents} events`);
    setStage("plan", "done", "Complete");
    setStatus("done", "Launch plan ready");
    deskTitle.textContent = "Release plan complete";
    runMeta.textContent += ` · ${event.durationMs} ms · ${event.textDeltas} text deltas`;
    copyButton.disabled = !finalPlan;
    return;
  }

  if (event.type === "error") {
    const error = new Error(event.message || "Launch Desk failed.");
    error.code = event.error;
    error.requestId = event.requestId;
    throw error;
  }
}

async function readNdjson(response, signal) {
  if (!response.body) throw new Error("Streaming is unavailable in this browser.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (signal.aborted) {
      await reader.cancel();
      throw new DOMException("Cancelled", "AbortError");
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      processEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) processEvent(JSON.parse(buffer));
}

async function runLaunch() {
  if (!form.reportValidity()) return;
  lastPayload = payloadFromForm();
  controller?.abort();
  controller = new AbortController();
  finalPlan = "";
  runStats = { toolEvents: 0, textDeltas: 0 };
  answerText.textContent = "";
  timeline.replaceChildren();
  runMeta.textContent = "";
  copyButton.disabled = true;
  resetStages();
  setStage("intake", "active", "Sending");
  setWorking(true);
  setStatus("working", "Starting agent");
  deskTitle.textContent = "Building the launch review";
  workingTitle.textContent = "Structuring the release";
  workingText.textContent = "Connecting the intake to the Launch Desk agent.";
  setPanel("working");

  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
      body: JSON.stringify(lastPayload),
      signal: controller.signal
    });

    await readNdjson(response, controller.signal);
    if (!response.ok && !finalPlan) throw new Error(`Request failed with status ${response.status}.`);
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("ready", "Run cancelled");
      if (!answerText.textContent) setPanel("empty");
      return;
    }

    setStatus("error", "Agent run failed");
    setStage("plan", "error", "Stopped");
    $("#errorMessage").textContent = error.requestId
      ? `${error.message} Reference: ${error.requestId}`
      : error.message;
    setPanel("error");
  } finally {
    setWorking(false);
    controller = null;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runLaunch();
});

cancelButton.addEventListener("click", () => controller?.abort());
retryButton.addEventListener("click", runLaunch);

sampleButton.addEventListener("click", () => {
  $("#productBrief").value = "Ship a public beta of an incident review workspace that links alerts, timelines, runbooks, and follow-up actions so engineering teams can turn production incidents into traceable reliability work.";
  $("#audience").value = "Platform engineering leads, SRE teams, and engineering managers at B2B software companies with growing on-call rotations.";
  $("#launchDate").value = "2026-08-15";
  $("#launchMode").value = "Measured rollout";
  $("#constraints").value = "Two backend engineers are available. Security review must finish before external access. No weekend launch. Rollback must take less than 15 minutes. Named launch DRI is not assigned yet.";
  $("#assets").value = "Working beta, QA checklist, architecture diagram, draft runbook, product screenshots, support escalation channel. Release notes and customer email are not drafted.";
  showToast("Example launch loaded.");
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(finalPlan || answerText.textContent);
    showToast("Launch plan copied.");
  } catch {
    showToast("Copy is unavailable in this browser.");
  }
});

resetStages();
setPanel("empty");
