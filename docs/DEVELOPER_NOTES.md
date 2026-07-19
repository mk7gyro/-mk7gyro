# Launch Desk developer notes

## Current OpenAI pattern

Launch Desk uses `@openai/agents` with the default OpenAI Responses provider. It does not use Assistants API or Chat Completions scaffolding. A reusable `Runner` owns shared model and tracing configuration; `Runner.run(..., { stream: true })` returns the full agent event stream.

## Streaming contract

The API intentionally does not expose SDK event objects. It emits:

- `run.started`
- `tool.started`
- `tool.completed`
- `agent.updated`
- `text.delta`
- `run.completed`
- `run.failed`

Consume the stream until it closes. The last visible text delta is not proof that post-processing and trace export are complete; the API waits for `stream.completed`.

## Tool extension pattern

1. Put deterministic, independently testable behavior in `src/core/`.
2. Wrap it with `tool()` and a strict Zod schema in `src/agent/tools.js`.
3. Give the tool a narrow description that states when it should be used.
4. Add tool timeout and idempotency considerations.
5. Add a progress label in the frontend only when the tool is part of the standard workflow.
6. Add unit tests for the core behavior and a stream test for the event mapping.

Keep authentication and side-effect authorization outside the model. These tools are read-only planners. A future Jira, GitHub, email, or deployment tool should require explicit product decisions and human approval.

## Handoffs

The current workflow intentionally uses one manager agent. Add a handoff only when a specialist must take ownership of the final response. Prefer an agent-as-tool when Launch Desk should retain control of synthesis and formatting.

## Reliability

- The route validates sizes before invoking the model.
- The browser can abort the request.
- The route has a 60-second execution budget.
- Tool executions have 5-second timeouts.
- SDK/model retries should be tuned only after observing real transient-failure rates.
- Do not retry user cancellation, invalid input, refusals, or deterministic tool failures.

## Observability

Tracing is enabled by default in Node server runtimes. The workflow is named `Launch Desk planning`, sensitive trace payload capture is disabled, and the API returns a correlation ID. Add metrics for time to first delta, total duration, tool latency, run failures, token use, and cost per successful plan.

## Local end-to-end verification

Run the server from a network context that can reach OpenAI:

```bash
npm run dev
npm run verify:e2e
```

The verifier does not accept health checks or static frontend success. It performs a real POST, drains the SSE stream, and exits successfully only after observing tool progress and model text.
