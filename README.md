# Launch Desk

Launch Desk is a full-stack engineering launch-planning agent. A team supplies a rough product brief, audience, launch date, constraints, assets, tone, and channels. The agent calls deterministic planning tools, then streams an actionable release recommendation.

## Output

- Release posture: go, conditional go, delay, or phased launch
- Prioritized P0/P1/P2 plan
- Risk register with likelihood, impact, mitigation, and triggers
- Role-based owner checklist
- Channel-specific launch copy suggestions
- Follow-up questions when critical inputs are missing

## OpenAI architecture

Launch Desk uses the current JavaScript/TypeScript **OpenAI Agents SDK** (`@openai/agents`) and the OpenAI Responses provider.

- `Agent` defines instructions, model settings, and function tools.
- A process-level `Runner` is reused across requests.
- `Runner.run(..., { stream: true })` supplies run-item events and raw Responses text deltas.
- Four function tools use strict Zod schemas.
- Agents SDK tracing is enabled by default in Node unless `OPENAI_AGENTS_DISABLE_TRACING=1`.
- No Assistants API, legacy Completions, or Chat Completions scaffolding is used.

The default model is `gpt-5.6-terra`, balancing quality and cost. Evaluate `gpt-5.6-sol` for high-stakes launch reviews or `gpt-5.6-luna` for bounded high-volume planning.

## Project structure

```text
api/agent.js                  Streaming agent API route
api/health.js                 Configuration-safe health route
src/agent/config.js           Model, reasoning, and tracing settings
src/agent/launch-agent.js     Agent instructions and process-level Runner
src/agent/tools.js            Agents SDK function tools
src/agent/stream.js           SDK event to public NDJSON adapter
src/core/planning.js          Deterministic planning and rubric logic
src/core/schemas.js           Request validation and channel contract
src/server/http.js            HTTP, streaming, and error helpers
src/server/local.js           Local frontend and API server
index.html                    Frontend shell
app.js                        Form, stream reader, and progressive UI
styles.css                    Responsive production styling
tests/                        Schema, planning, and stream adapter tests
scripts/verify-sdk.mjs        Agent and tool construction smoke test
scripts/verify-stream.mjs     Real streamed endpoint verification
docs/DEVELOPER_NOTES.md       Extension, handoff, tracing, and event notes
```

## Client/server boundary

### Browser

- Collects launch inputs.
- Calls only same-origin `/api/agent`.
- Reads newline-delimited JSON progressively.
- Renders tool progress and model text deltas.
- Never imports the OpenAI SDK and never receives `OPENAI_API_KEY`.

### Server

- Validates every request with Zod.
- Owns the Agents SDK, model configuration, tools, tracing, and API key.
- Streams normalized progress events instead of raw provider payloads.
- Excludes sensitive inputs and outputs from trace payloads while retaining spans.

## Requirements

- Node.js 20–22
- An OpenAI API project with access to the configured model

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set the server-side key:

```env
OPENAI_API_KEY=sk-...
OPENAI_AGENT_MODEL=gpt-5.6-terra
OPENAI_AGENT_REASONING_EFFORT=low
OPENAI_AGENTS_DISABLE_TRACING=0
```

Do not use `VITE_`, `NEXT_PUBLIC_`, or another browser-facing variable name for the API key.

Start the built-in Node server, which serves the frontend and API routes in one process:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`. The server loads `.env.local` before importing the agent configuration.

## Required real stream verification

With the server running in a process that has `OPENAI_API_KEY`, run:

```bash
npm run verify:e2e
```

The verifier posts a realistic brief to `http://localhost:3000/api/agent`, drains the NDJSON stream, and fails unless it receives both:

1. at least one tool progress or result event; and
2. at least one model text delta.

To verify another environment:

```bash
LAUNCH_DESK_URL=https://your-host/api/agent npm run verify:e2e
```

A health check, frontend load, syntax pass, or unit tests are not substitutes for this verification.

## Commands

```bash
npm test
npm run check
npm run build
npm run verify:e2e
```

## Deployment

The repository is configured for Vercel:

1. Import the repository.
2. Add `OPENAI_API_KEY` to Preview and Production.
3. Optionally configure model, reasoning effort, and tracing variables.
4. Deploy.
5. Run the streamed verifier against the deployed `/api/agent` endpoint.

The agent route allows up to 120 seconds for multi-turn tool execution and streaming.

## Extension points

- **Model:** `OPENAI_AGENT_MODEL` or `src/agent/config.js`
- **Reasoning:** `OPENAI_AGENT_REASONING_EFFORT`
- **Instructions/output contract:** `src/agent/launch-agent.js`
- **Tools:** `src/agent/tools.js`
- **Rubric and task logic:** `src/core/planning.js`
- **Streaming protocol:** `src/agent/stream.js`
- **Handoffs:** add specialist agents and register them in `launch-agent.js`
- **UI:** `app.js` and `styles.css`

## Validation checklist

### Agent behavior

- [ ] Calls at least one tool and normally calls all four tools.
- [ ] Produces every required final section.
- [ ] Does not invent proof, named owners, or readiness evidence.
- [ ] Marks missing details and asks targeted follow-up questions.
- [ ] Connects P0 work to owners and completion signals.
- [ ] Recommends a posture consistent with readiness evidence.

### Tool outputs

- [ ] Task extraction returns a bounded P0/P1/P2 list.
- [ ] Readiness returns a score, posture, blockers, gaps, and days remaining.
- [ ] Owner checklist returns role groups with operational items.
- [ ] Copy tool returns one brief per selected channel.
- [ ] Tool logic is deterministic and unit-testable without OpenAI.

### Frontend and streaming

- [ ] Empty, active, completed, cancelled, and error states render correctly.
- [ ] Tool cards update before the final answer completes.
- [ ] Text appears incrementally.
- [ ] Copy plan works after completion.
- [ ] Mobile layout remains usable.
- [ ] `npm run verify:e2e` observes a tool event and text delta.

### Operations

- [ ] `OPENAI_API_KEY` is server-side in every target environment.
- [ ] Traces appear under `Launch Desk planning` when enabled.
- [ ] GET `/api/agent` returns 405.
- [ ] Rate-limit and authentication failures are safe and useful.
- [ ] Production streaming is not buffered by a proxy or CDN.
