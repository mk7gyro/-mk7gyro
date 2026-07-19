const endpoint = process.env.LAUNCH_DESK_URL || "http://localhost:3000/api/agent";
const payload = {
  productBrief: "Launch a public beta of an API observability feature with trace search, latency breakdowns, and source-linked diagnostics. Billing is out of scope.",
  audience: "Platform engineers at B2B software companies",
  launchDate: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
  constraints: "Security review is required. Rollout is limited to 20 beta accounts. A rollback flag exists but the monitoring runbook is incomplete.",
  availableAssets: "Dogfood results, API reference draft, screenshots, demo, feature flag, beta list, support FAQ.",
  tone: "Technical, precise, and restrained",
  channels: ["Release notes", "Email", "Developer community", "Docs"]
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Agent endpoint returned ${response.status}: ${body}`);
}
if (!response.body) throw new Error("Agent endpoint did not return a readable stream.");

let sawTool = false;
let sawText = false;
let buffer = "";
let eventTotal = 0;
const decoder = new TextDecoder();
const reader = response.body.getReader();

while (true) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    eventTotal += 1;
    if (event.type === "tool_progress" || event.type === "tool_result") sawTool = true;
    if (event.type === "text_delta" && event.delta) sawText = true;
    if (event.type === "error") throw new Error(`${event.error}: ${event.message}`);
  }
  if (done) break;
}

if (!sawTool) throw new Error("No tool progress event was received.");
if (!sawText) throw new Error("No model text delta was received.");
console.log(`E2E stream verified: endpoint=${endpoint}, events=${eventTotal}, toolEvent=${sawTool}, textDelta=${sawText}`);
