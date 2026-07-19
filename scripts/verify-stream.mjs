const baseUrl = process.env.LAUNCH_DESK_URL || "http://localhost:3000";
const payload = {
  brief: "Launch a developer-facing incident review assistant. It has a beta demo, needs security approval, must include rollback and monitoring, and success is weekly active teams.",
  audience: "Site reliability and platform engineering teams",
  launchDate: "2026-09-15",
  constraints: "Two engineers; security sign-off; no pricing change",
  assets: "Beta demo; documentation draft; three design partner quotes"
};

const response = await fetch(`${baseUrl}/api/agent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

if (!response.ok || !response.body) {
  throw new Error(`Agent endpoint failed: ${response.status} ${await response.text()}`);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let sawTool = false;
let sawText = false;

while (true) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
  const blocks = buffer.split("\n\n");
  buffer = blocks.pop() || "";
  for (const block of blocks) {
    const event = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
    if (event === "tool.started" || event === "tool.completed") sawTool = true;
    if (event === "text.delta") sawText = true;
    process.stdout.write(`.${event || "message"}`);
  }
  if (sawTool && sawText) {
    console.log("\nVerified tool progress and model text delta.");
    process.exit(0);
  }
  if (done) break;
}

throw new Error(`Stream ended before verification. sawTool=${sawTool} sawText=${sawText}`);
