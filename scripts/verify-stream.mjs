const baseUrl = process.env.LAUNCH_DESK_BASE_URL || "http://127.0.0.1:3000";
const endpoint = new URL("/api/agent", baseUrl);

const payload = {
  productBrief: "Launch a public beta of an incident review workspace that connects alerts, timelines, runbooks, and follow-up reliability work.",
  audience: "Platform engineering leads and SRE teams at B2B software companies",
  launchDate: "2026-08-15",
  constraints: "Security review required. Rollback under 15 minutes. No weekend launch.",
  assets: "QA checklist, draft runbook, screenshots, support escalation channel."
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
  body: JSON.stringify(payload)
});

if (!response.body) throw new Error("The endpoint did not return a readable stream.");

let sawTool = false;
let sawText = false;
let completed = false;
let buffer = "";
const decoder = new TextDecoder();

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "tool_progress") sawTool = true;
    if (event.type === "text_delta" && event.delta) sawText = true;
    if (event.type === "complete") completed = true;
    if (event.type === "error") throw new Error(`${event.error}: ${event.message}`);
    if (sawTool && sawText) {
      console.log("E2E stream verified: received a tool progress event and a model text delta.");
    }
  }
}

if (!response.ok) throw new Error(`Agent endpoint returned HTTP ${response.status}.`);
if (!sawTool) throw new Error("No tool progress event was received.");
if (!sawText) throw new Error("No model text delta was received.");
if (!completed) throw new Error("No completion event was received.");
