const $ = (selector) => document.querySelector(selector);
const form = $("#launchForm");
const runButton = $("#runButton");
const cancelButton = $("#cancelButton");
const copyButton = $("#copyButton");
const output = $("#planOutput");
const empty = $("#emptyState");
const statusPill = $("#statusPill");
const statusText = $("#statusText");
const runMeta = $("#runMeta");
const toast = $("#toast");
let controller = null;
let planText = "";

function setStatus(state, label) {
  statusPill.dataset.state = state;
  statusText.textContent = label;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function resetProgress() {
  document.querySelectorAll(".progress-step").forEach((step) => {
    step.classList.remove("active", "done");
    step.querySelector("small").textContent = "Waiting";
  });
}

function updateTool(tool, completed) {
  const step = document.querySelector(`[data-tool="${CSS.escape(tool)}"]`);
  if (!step) return;
  step.classList.toggle("active", !completed);
  step.classList.toggle("done", completed);
  step.querySelector("small").textContent = completed ? "Complete" : "Running";
}

function parseSseBlock(block) {
  let event = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

function handleEvent(message) {
  if (!message) return;
  const { event, data } = message;
  if (event === "run.started") {
    setStatus("working", "Agent working");
    runMeta.textContent = `Model: ${data.model}`;
  }
  if (event === "tool.started") updateTool(data.tool, false);
  if (event === "tool.completed") updateTool(data.tool, true);
  if (event === "text.delta") {
    planText += data.delta;
    output.textContent = planText;
    output.scrollTop = output.scrollHeight;
  }
  if (event === "run.completed") {
    setStatus("done", "Plan ready");
    runMeta.textContent = `${data.model} · ${(data.durationMs / 1000).toFixed(1)}s · Request ${data.requestId.slice(0, 8)}`;
  }
  if (event === "run.failed") throw new Error(data.message || "The agent run failed.");
}

async function runAgent(payload) {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Launch Desk could not start.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) handleEvent(parseSseBlock(block));
    if (done) break;
  }
  if (buffer.trim()) handleEvent(parseSseBlock(buffer));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  controller = new AbortController();
  planText = "";
  output.textContent = "";
  empty.hidden = true;
  output.hidden = false;
  resetProgress();
  runMeta.textContent = "";
  runButton.disabled = true;
  cancelButton.hidden = false;
  copyButton.disabled = true;
  setStatus("working", "Connecting");

  try {
    await runAgent(Object.fromEntries(new FormData(form)));
    copyButton.disabled = !planText;
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("ready", "Run stopped");
      showToast("Agent run stopped.");
    } else {
      setStatus("error", "Needs attention");
      showToast(error.message);
    }
  } finally {
    runButton.disabled = false;
    cancelButton.hidden = true;
    controller = null;
  }
});

cancelButton.addEventListener("click", () => controller?.abort());
copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(planText);
  showToast("Launch plan copied.");
});
output.hidden = true;
