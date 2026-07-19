# Launch Desk developer notes

## Request lifecycle

1. `app.js` posts the validated form payload to `POST /api/agent`.
2. The route validates again with Zod and starts an NDJSON response.
3. A process-level `Runner` executes `launchAgent` with `stream: true`.
4. SDK tool, agent-update, and Responses text-delta events are normalized in `src/agent/stream.js`.
5. Tools also report deterministic results through the run context, allowing the UI to update before final prose completes.
6. The browser reads lines, updates tool cards, and renders accumulated Markdown.

## Adding tools

Create one narrow tool in `src/agent/tools.js` with a strict Zod schema. Keep deterministic logic in `src/core/` so it can be tested without an API call. Add the tool to `launchTools`, update instructions when it is mandatory, and add unit coverage.

## Adding handoffs

For a larger workflow, add specialist agents such as Security Readiness or Developer Marketing and expose them through `handoffs` or `Agent.asTool()`. Keep Launch Desk as coordinator and preserve the final output contract. Add handoff events to `mapAgentEvent()` so the frontend can show the active specialist.

## Tracing and logs

Agents SDK tracing is enabled by default in Node. Launch Desk names the workflow `Launch Desk planning` and excludes sensitive tool/model inputs and outputs. Set `OPENAI_AGENTS_DISABLE_TRACING=1` only when required. API logs include request IDs and safe error metadata.

## Streaming contract

The API emits one JSON object per line. Public event types are `run_started`, `status`, `tool_progress`, `tool_result`, `text_delta`, `run_completed`, and `error`. Clients should ignore unknown event types for forward compatibility.
