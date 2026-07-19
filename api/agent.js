import { randomUUID } from "node:crypto";
import { launchAgent, launchRunner } from "../src/agent/launch-agent.js";
import { validateLaunchRequest } from "../src/agent/schemas.js";
import { mapAgentStreamEvent } from "../src/agent/stream-events.js";
import { beginNdjson, safeAgentError, writeError, writeEvent } from "../src/server/ndjson.js";
import { AGENT_MODEL } from "../src/agent/config.js";

export const config = { maxDuration: 120 };

function formatLaunchInput(input) {
  return [
    "Create an engineering launch plan from the following intake.",
    "",
    `PRODUCT BRIEF\n${input.productBrief}`,
    "",
    `AUDIENCE\n${input.audience}`,
    "",
    `TARGET LAUNCH DATE\n${input.launchDate}`,
    "",
    `CONSTRAINTS\n${input.constraints || "No constraints were supplied."}`,
    "",
    `AVAILABLE ASSETS\n${input.assets || "No assets were supplied."}`,
    "",
    "Use the tools before the final answer. Make missing details explicit."
  ].join("\n");
}

export default async function handler(req, res) {
  const requestId = randomUUID();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    beginNdjson(res, 405);
    return writeError(res, 405, "method_not_allowed", "Use POST to run Launch Desk.", requestId);
  }

  if (!process.env.OPENAI_API_KEY) {
    beginNdjson(res, 500);
    return writeError(res, 500, "server_not_configured", "OPENAI_API_KEY is not configured on the server.", requestId);
  }

  const parsed = validateLaunchRequest(req.body || {});
  if (!parsed.ok) {
    beginNdjson(res, 400);
    return writeError(res, 400, "invalid_input", parsed.message, requestId);
  }

  beginNdjson(res);
  writeEvent(res, {
    type: "meta",
    requestId,
    model: AGENT_MODEL,
    tracing: process.env.OPENAI_AGENTS_DISABLE_TRACING === "1" ? "disabled" : "enabled"
  });

  const abortController = new AbortController();
  req.on?.("aborted", () => abortController.abort());

  let toolEvents = 0;
  let textDeltas = 0;
  const startedAt = Date.now();

  try {
    const stream = await launchRunner.run(
      launchAgent,
      formatLaunchInput(parsed.data),
      {
        stream: true,
        maxTurns: 10,
        signal: abortController.signal,
        context: { requestId }
      }
    );

    for await (const event of stream) {
      for (const mapped of mapAgentStreamEvent(event)) {
        if (mapped.type === "tool_progress") toolEvents += 1;
        if (mapped.type === "text_delta") textDeltas += 1;
        writeEvent(res, { ...mapped, requestId });
      }
    }

    await stream.completed;
    writeEvent(res, {
      type: "complete",
      requestId,
      finalOutput: stream.finalOutput || "",
      toolEvents,
      textDeltas,
      durationMs: Date.now() - startedAt,
      lastResponseId: stream.lastResponseId || null
    });
    res.end();
  } catch (error) {
    console.error("launch_desk.run_failed", {
      requestId,
      name: error?.name,
      status: error?.status,
      message: error?.message
    });
    const mapped = safeAgentError(error);
    writeError(res, mapped.status, mapped.code, mapped.message, requestId);
  }
}
