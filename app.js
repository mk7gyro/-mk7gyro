const $ = (selector) => document.querySelector(selector);
const form = $("#launchForm");
const runButton = $("#runButton");
const cancelButton = $("#cancelButton");
const sampleButton = $("#sampleButton");
const retryButton = $("#retryButton");
const copyButton = $("#copyButton");
const emptyState = $("#emptyState");
const errorState = $("#errorState");
const errorMessage = $("#errorMessage");
const output = $("#output");
const markdownOutput = $("#markdownOutput");
const deskTitle = $("#deskTitle");
const runStatus = $("#runStatus");
const runStatusText = $("#runStatusText");
const liveIndicator = $("#liveIndicator");
const eventCount = $("#eventCount");
const resultMeta = $("#resultMeta");
const verificationBadge = $("#verificationBadge");
const toast = $("#toast");

let controller = null;
let accumulatedText = "";
let eventsSeen = 0;
let toolEvents = 0;
let textDeltas = 0;

function setStatus(state, text) {
  runStatus.dataset.state = state;
  runStatusText.textContent = text;
}

function setView(view) {
  emptyState.hidden = view !== "empty";
  errorState.hidden = view !== "error";
  output.hidden = view !== "output";
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
  form.querySelectorAll("input, textarea, select").forEach((node) => { node.disabled = working; });
}

function resetTools() {
  document.querySelectorAll("[data-tool]").forEach((node) => {
    node.dataset.state = "waiting";
    node.querySelector("small").textContent = "Waiting";
  });
}

function updateTool(tool, phase, message) {
  const node = document.querySelector(`[data-tool="${tool}"]`);
  if (!node) return;
  node.dataset.state = phase === "completed" ? "done" : "active";
  node.querySelector("small").textContent = phase === "completed" ? "Complete" : (message || "Running");
}

function getPayload() {
  return {
    productBrief: $("#productBrief").value.trim(),
    audience: $("#audience").value.trim(),
    launchDate: $("#launchDate").value,
    constraints: $("#constraints").value.trim(),
    availableAssets: $("#availableAssets").value.trim(),
    tone: $("#tone").value,
    channels: [...document.querySelectorAll('input[name="channels"]:checked')].map((node) => node.value)
  };
}

function inlineMarkup(text) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let list = null;
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = null;
  };

  for (const line of lines) {
    if (/^###\s+/.test(line)) { closeList(); html += `<h3>${inlineMarkup(line.replace(/^###\s+/, ""))}</h3>`; }
    else if (/^##\s+/.test(line)) { closeList(); html += `<h2>${inlineMarkup(line.replace(/^##\s+/, ""))}</h2>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h1>${inlineMarkup(line.replace(/^#\s+/, ""))}</h1>`; }
    else if (/^[-*]\s+/.test(line)) {
      if (list !== "ul") { closeList(); list = "ul"; html += "<ul>"; }
      html += `<li>${inlineMarkup(line.replace(/^[-*]\s+/, ""))}</li>`;
    } else if (/^\d+\.\s+/.test(line)) {
      if (list !== "ol") { closeList(); list = "ol"; html += "<ol>"; }
      html += `<li>${inlineMarkup(line.replace(/^\d+\.\s+/, ""))}</li>`;
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList(); html += `<p>${inlineMarkup(line)}</p>`;
    }
  }
  closeList();
  markdownOutput.innerHTML = html;
}

function handleEvent(event) {
  eventsSeen += 1;
  eventCount.textContent = `${eventsSeen} events`;

  if (event.type === "run_started") {
    resultMeta.textContent = `${event.model} · tracing ${event.tracing} · ${event.requestId}`;
    return;
  }
  if (event.type === "tool_progress" || event.type === "tool_result") {
    toolEvents += 1;
    updateTool(event.tool, event.phase, event.message || event.summary);
    return;
  }
  if (event.type === "text_delta") {
    textDeltas += 1;
    accumulatedText += event.delta;
    renderMarkdown(accumulatedText);
    return;
  }
  if (event.type === "run_completed") {
    if (!accumulatedText && event.finalOutput) {
      accumulatedText = String(event.finalOutput);
      renderMarkdown(accumulatedText);
    }
    liveIndicator.dataset.state = "done";
    liveIndicator.querySelector("strong").textContent = "Plan complete";
    verificationBadge.textContent = event.verification?.sawToolEvent && event.verification?.sawTextDelta
      ? "Tool + text stream verified"
      : "Stream completed";
    setStatus("done", "Plan ready");
    copyButton.disabled = !accumulatedText;
    return;
  }
  if (event.type === "error") throw Object.assign(new Error(event.message), { code: event.error });
}

async function readNdjson(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }
  if (!response.body) throw new Error("The browser did not receive a response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      handleEvent(JSON.parse(line));
    }
    if (done) break;
  }
  if (buffer.trim()) handleEvent(JSON.parse(buffer));
}

async function runLaunch() {
  if (!form.reportValidity()) return;
  const payload = getPayload();
  if (!payload.channels.length) return showToast("Select at least one channel.");

  accumulatedText = "";
  eventsSeen = 0;
  toolEvents = 0;
  textDeltas = 0;
  markdownOutput.replaceChildren();
  verificationBadge.textContent = "";
  copyButton.disabled = true;
  resetTools();
  controller?.abort();
  controller = new AbortController();
  setWorking(true);
  setView("output");
  setStatus("working", "Agent running");
  deskTitle.textContent = "Building the release system";
  liveIndicator.dataset.state = "live";
  liveIndicator.querySelector("strong").textContent = "Streaming agent run";
  eventCount.textContent = "0 events";

  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    await readNdjson(response);
    if (!toolEvents || !textDeltas) {
      verificationBadge.textContent = `Completed · ${toolEvents} tool events · ${textDeltas} text deltas`;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("idle", "Run cancelled");
      liveIndicator.dataset.state = "stopped";
      liveIndicator.querySelector("strong").textContent = "Run cancelled";
    } else {
      errorMessage.textContent = error.message;
      setView("error");
      setStatus("error", "Run failed");
      deskTitle.textContent = "Launch plan unavailable";
    }
  } finally {
    setWorking(false);
    controller = null;
  }
}

form.addEventListener("submit", (event) => { event.preventDefault(); runLaunch(); });
cancelButton.addEventListener("click", () => controller?.abort());
retryButton.addEventListener("click", runLaunch);

sampleButton.addEventListener("click", () => {
  $("#productBrief").value = "Launch a public beta of an API observability feature that traces customer requests across our gateway and worker runtime. The beta includes trace search, latency breakdowns, and source-linked error diagnostics. Billing and long-term retention are out of scope for this release.";
  $("#audience").value = "Platform engineers and engineering leads at mid-market B2B software companies operating production APIs.";
  const launch = new Date(Date.now() + 21 * 86_400_000);
  $("#launchDate").value = launch.toISOString().slice(0, 10);
  $("#constraints").value = "Security review must finish before launch. Rollout is limited to 20 beta accounts in week one. Two backend engineers are available. A rollback flag exists, but the monitoring runbook is incomplete.";
  $("#availableAssets").value = "Internal dogfood results, API reference draft, three screenshots, demo recording, feature flag, beta customer list, and an initial support FAQ. No approved customer quotes.";
  $("#tone").value = "Technical, precise, and restrained";
  document.querySelectorAll('input[name="channels"]').forEach((node) => {
    node.checked = ["Release notes", "Email", "LinkedIn", "Developer community", "Docs"].includes(node.value);
  });
  showToast("Example launch loaded.");
});

copyButton.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(accumulatedText); showToast("Launch plan copied."); }
  catch { showToast("Copy is unavailable in this browser."); }
});

const defaultDate = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
$("#launchDate").value = defaultDate;
resetTools();
setView("empty");
