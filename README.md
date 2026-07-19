# Launch Desk

Launch Desk is a full-stack engineering launch-planning agent. A user supplies a product brief, audience, target date, constraints, and available assets. The agent returns a prioritized release plan, risk register, owner checklist, channel-specific launch copy, and focused follow-up questions.

The implementation uses the current OpenAI **Agents SDK for JavaScript/TypeScript** with the OpenAI Responses provider. It does not use the deprecated Assistants API, legacy Completions, or hand-written Chat Completions tool loops.

## What the agent does

- Forces at least one function-tool call before the final answer.
- Extracts release tasks from the product brief.
- Scores readiness against a deterministic rubric.
- Generates an owner-role checklist with evidence requirements.
- Drafts restrained release-note, email, social, and in-product copy.
- Streams tool progress and model text deltas to the browser.
- Preserves uncertainty and asks follow-up questions when details are missing.

## Architecture

```text
index.html                       Frontend shell and launch intake
styles.css                      Responsive visual system
app.js                          NDJSON stream client and progressive UI
api/agent.js                    Server-side streamed Agents SDK endpoint
api/health.js                   Configuration health endpoint
src/agent/config.js             Model and reasoning settings
src/agent/schemas.js            API and tool Zod schemas
src/agent/tools.js              Pure planning helpers + four function tools
src/agent/launch-agent.js       Agent instructions and reusable Runner
src/agent/stream-events.js      SDK event → application event adapter
src/agent/observability.js      Runner lifecycle logging hooks
src/server/ndjson.js            Stream response and safe error helpers
tests/                          Validation, tool, and stream-protocol tests
scripts/verify-sdk.mjs          Construction smoke check
scripts/verify-stream.mjs       Real streamed endpoint verification
docs/DEVELOPER_NOTES.md         Extension and operations notes
```

### Client/server boundary

The browser sends the intake only to `POST /api/agent`. It receives newline-delimited JSON events:

- `meta`
- `agent`
- `tool_progress`
- `text_delta`
- `complete`
- `error`

The browser does not import `@openai/agents`, does not call OpenAI directly, and never receives `OPENAI_API_KEY`.

The server validates input, runs the agent, executes tools, streams safe progress events, and maps upstream errors to application-safe messages.

## Current SDK patterns

- `new Agent({ instructions, tools, modelSettings })`
- Zod-backed `tool()` function tools
- One reusable `Runner` created at module startup
- `runner.run(agent, input, { stream: true })`
- Full `for await` event processing for tool and raw model events
- `await stream.completed`
- Forced first tool call with `modelSettings.toolChoice = "required"`
- Default `resetToolChoice = true`, allowing the model to produce its final answer after tool execution
- Built-in server tracing with `workflowName`, metadata, and sensitive payload capture disabled

## Requirements

- Node.js 20 or newer
- An OpenAI API project with access to the configured model
- Vercel CLI for the included local server workflow

## Local setup

```bash
npm install
cp .env.example .env.local
```

Configure the server environment:

```env
OPENAI_API_KEY=sk-...
OPENAI_AGENT_MODEL=gpt-5.6-terra
LAUNCH_DESK_REASONING_EFFORT=low
OPENAI_AGENTS_DISABLE_TRACING=0
```

Start the static frontend and API routes in the same server process:

```bash
npm run dev
```

Open the local URL printed by Vercel Dev, normally `http://127.0.0.1:3000`.

## Required real stream verification

A successful health check or frontend load is not sufficient. Keep the dev server running and execute:

```bash
npm run verify:e2e
```

The script performs a real streamed `POST /api/agent`, reads the stream to completion, and fails unless it receives:

1. at least one `tool_progress` event
2. at least one non-empty `text_delta`
3. a final `complete` event

For a non-default local URL:

```bash
LAUNCH_DESK_BASE_URL=http://127.0.0.1:3001 npm run verify:e2e
```

This verification uses the `OPENAI_API_KEY` loaded by the server process. It therefore confirms the local server can actually reach OpenAI, rather than merely proving localhost routing works.

## Commands

```bash
npm test
npm run check
npm run build
npm run dev
npm run verify:e2e
```

## Model guidance

The default is `gpt-5.6-terra`, which balances intelligence and cost for production planning. Set `OPENAI_AGENT_MODEL=gpt-5.6-sol` for the highest-quality complex release reviews, or evaluate `gpt-5.6-luna` for high-volume bounded planning.

Change the model in `src/agent/config.js` or through `OPENAI_AGENT_MODEL`.

## Where to extend

- **Agent behavior:** `LAUNCH_DESK_INSTRUCTIONS` in `src/agent/launch-agent.js`
- **Tool schemas and logic:** `src/agent/schemas.js` and `src/agent/tools.js`
- **Model/reasoning:** `src/agent/config.js`
- **Streaming protocol:** `src/agent/stream-events.js` and `api/agent.js`
- **UI rendering:** `app.js`
- **Handoffs:** add specialist agents and `handoff()` entries in `src/agent/launch-agent.js`
- **Persistent threads:** add an SDK session, `conversationId`, or `previousResponseId`; do not mix persistence strategies without deliberate reconciliation

## Tracing and observability

The Agents SDK enables tracing by default in Node server runtimes. Launch Desk configures:

- workflow name: `Launch Desk release planning`
- trace metadata identifying the app and web surface
- `traceIncludeSensitiveData: false`
- runner lifecycle logs for agent and tool start/end events

Set `OPENAI_AGENTS_DISABLE_TRACING=1` only when tracing must be disabled. Organizations using Zero Data Retention cannot use OpenAI tracing.

## Deployment

The repository is configured for Vercel:

1. Import the repository.
2. Add `OPENAI_API_KEY` to Preview and Production.
3. Optionally add the model, reasoning, and tracing environment variables.
4. Deploy.

Never expose the key through public prefixes such as `VITE_`, `NEXT_PUBLIC_`, or browser code.

## Validation checklist

### Agent behavior

- [ ] The agent calls at least one tool before final output.
- [ ] The final answer includes launch summary, prioritized plan, risk register, owner checklist, launch copy, and follow-up questions.
- [ ] Unsupported claims, customer proof, approvals, or completed work are not invented.
- [ ] Missing launch-critical details become explicit questions.
- [ ] P0 blockers appear before P1/P2 improvements.
- [ ] Owner entries use roles unless actual names were supplied.

### Tool outputs

- [ ] Task extraction returns concrete, prioritized work.
- [ ] Readiness score is bounded from 0 to 100 and includes failed checks.
- [ ] Owner checklist includes owner, priority, timing, and acceptance evidence.
- [ ] Channel copy includes only requested channels and avoids unsupported metrics.
- [ ] Tool inputs are strictly validated by Zod.

### Frontend and stream

- [ ] Empty, working, results, error, cancellation, and retry states render correctly.
- [ ] At least one tool event appears before or during model output.
- [ ] Text appears progressively from `text_delta` events.
- [ ] Copy-plan action works after completion.
- [ ] Mobile and desktop layouts remain usable.
- [ ] The browser never receives an OpenAI credential.

### End-to-end

- [ ] `npm run check` passes.
- [ ] `npm run dev` starts frontend and backend together.
- [ ] `npm run verify:e2e` receives a tool event, text delta, and completion event.
- [ ] The server process can resolve and connect to the OpenAI API.
- [ ] Invalid input receives a streamed `invalid_input` error.
- [ ] Missing server key receives `server_not_configured`.
- [ ] Traces appear under the configured workflow when tracing is enabled.
