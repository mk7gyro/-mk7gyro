import { randomUUID } from "node:crypto";
import { launchDeskAgent, launchRunner, MODEL } from "../src/agent/launch-agent.js";
import { formatAgentInput, validateLaunchInput } from "../src/core/planning.js";
import { extractTextDelta, toolEventName, toolLabel, writeSse } from "../src/server/sse.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed", message: "Use POST to create a launch plan." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "server_not_configured", message: "OPENAI_API_KEY is not configured on the server." });
  }

  const parsed = validateLaunchInput(req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: "invalid_input", message: parsed.errors.join(" ") });

  const requestId = randomUUID();
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const startedAt = Date.now();
  writeSse(res, "run.started", { requestId, model: MODEL });

  try {
    const stream = await launchRunner.run(launchDeskAgent, formatAgentInput(parsed.data), {
      stream: true,
      maxTurns: 10,
      workflowName: "Launch Desk planning",
      traceIncludeSensitiveData: false,
      context: { requestId }
    });

    for await (const event of stream) {
      const delta = extractTextDelta(event);
      if (delta) writeSse(res, "text.delta", { delta });

      const mapped = toolEventName(event);
      if (mapped) writeSse(res, mapped, { tool: toolLabel(event) });

      if (event.type === "agent_updated_stream_event") {
        writeSse(res, "agent.updated", { agent: event.agent?.name || "Launch Desk" });
      }
    }

    await stream.completed;
    writeSse(res, "run.completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      model: MODEL
    });
  } catch (error) {
    console.error("Launch Desk run failed", { requestId, name: error?.name, message: error?.message });
    writeSse(res, "run.failed", {
      requestId,
      message: "Launch Desk could not complete this plan. Review the input and try again."
    });
  } finally {
    res.end();
  }
}
