import { randomUUID } from "node:crypto";
import { launchAgent, launchRunner } from "../src/agent/launch-agent.js";
import { AGENT_MODEL, TRACING_DISABLED } from "../src/agent/config.js";
import { encodeEvent, mapAgentEvent } from "../src/agent/stream.js";
import { validateLaunchInput } from "../src/core/schemas.js";
import { beginNdjson, safeError, sendJson } from "../src/server/http.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed", message: "Use POST to create a launch plan." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "server_not_configured", message: "OPENAI_API_KEY is not configured on the server." });
  }

  const parsed = validateLaunchInput(req.body || {});
  if (!parsed.ok) return sendJson(res, 400, { error: "invalid_input", message: parsed.message, issues: parsed.issues });

  const requestId = randomUUID();
  const startedAt = Date.now();
  const abortController = new AbortController();
  let finished = false;
  let sawToolEvent = false;
  let sawTextDelta = false;

  res.on("close", () => {
    if (!finished) abortController.abort();
  });

  beginNdjson(res);
  const write = (event) => {
    if (res.writableEnded || res.destroyed) return;
    if (event.type === "tool_progress" || event.type === "tool_result") sawToolEvent = true;
    if (event.type === "text_delta" && event.delta) sawTextDelta = true;
    res.write(encodeEvent({ requestId, timestamp: new Date().toISOString(), ...event }));
  };

  write({
    type: "run_started",
    model: AGENT_MODEL,
    tracing: TRACING_DISABLED ? "disabled" : "enabled",
    message: "Launch Desk is analyzing the release context."
  });

  const context = {
    launchInput: parsed.data,
    reportTool(event) {
      write({ type: "tool_result", ...event });
    }
  };

  try {
    const stream = await launchRunner.run(launchAgent, JSON.stringify(parsed.data), {
      stream: true,
      context,
      maxTurns: 10,
      signal: abortController.signal
    });

    for await (const event of stream) {
      for (const mapped of mapAgentEvent(event)) write(mapped);
    }
    await stream.completed;

    write({
      type: "run_completed",
      durationMs: Date.now() - startedAt,
      finalOutput: stream.finalOutput || null,
      verification: { sawToolEvent, sawTextDelta }
    });
  } catch (error) {
    const mapped = safeError(error);
    console.error("Launch Desk run failed", {
      requestId,
      name: error?.name,
      status: error?.status,
      message: error?.message
    });
    write({ type: "error", error: mapped.code, message: mapped.message });
  } finally {
    finished = true;
    if (!res.writableEnded) res.end();
  }
}
