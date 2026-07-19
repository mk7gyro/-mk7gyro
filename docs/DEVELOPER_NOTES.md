# Launch Desk developer notes

## Agent loop

Launch Desk uses one manager agent and four local function tools. The first model turn is configured with `toolChoice: "required"`. The SDK resets tool choice to `auto` after a tool call, so the run can finish with ordinary text instead of looping indefinitely.

The agent instructions encourage all relevant tools, but the application contract only requires at least one tool event. This makes the UI resilient to model-specific tool selection while guaranteeing progressive activity.

## Streaming adapter

`src/agent/stream-events.js` is the compatibility boundary between Agents SDK events and the browser protocol.

It recognizes:

- `run_item_stream_event` with `tool_called`
- `run_item_stream_event` with `tool_output`
- OpenAI Responses raw `response.output_text.delta`
- the transport-agnostic `output_text_delta` fallback

Keep provider-specific event inspection inside this module.

## Adding tools

1. Write a pure deterministic helper.
2. Add unit tests for the helper.
3. Define a strict Zod schema.
4. Wrap the helper with `tool()`.
5. Add it to `launchTools`.
6. Update the agent instructions only when the tool changes planning policy.
7. Re-run `npm run check` and the real `npm run verify:e2e`.

Avoid side effects in planning tools. A future deployment or issue-creation tool should require approval, be idempotent by call ID, and have explicit authorization boundaries.

## Adding handoffs

A practical next step is a specialist security-readiness agent or release-communications agent. Use SDK handoffs when the specialist should take over the turn. Use `agent.asTool()` when Launch Desk should remain the user-facing manager.

Expose handoff events through the stream adapter before relying on them in the UI.

## Persistence

This version is single-turn by design. For multi-turn refinement, choose one strategy:

- SDK session
- OpenAI `conversationId`
- Responses `previousResponseId`
- application-managed `result.history`

Do not send both full local history and a server-managed continuation identifier unless duplication is intentional.

## Operations

The server emits request IDs to the client and structured lifecycle logs. Agents SDK tracing is enabled by default in Node and grouped under the configured workflow. Sensitive model and tool payload capture is disabled.

The streamed endpoint is capped at ten agent turns and a 120-second serverless duration.
