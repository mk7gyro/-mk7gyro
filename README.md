# Launch Desk

Launch Desk is a polished web app that turns a rough product launch idea into an actionable engineering release plan. It uses the current TypeScript OpenAI Agents SDK, function tools, built-in tracing, and a server-sent event stream.

## What it produces

- Prioritized P0/P1/P2 launch plan
- Risk register with mitigation, triggers, and owner roles
- Role-based owner checklist
- Internal, email, social, and changelog copy suggestions
- Follow-up questions for missing launch decisions

## Architecture

### Browser

- Collects the brief, audience, date, constraints, and assets.
- Posts JSON to `POST /api/agent`.
- Reads SSE until the run ends.
- Renders tool progress separately from model text deltas.
- Supports cancellation through `AbortController`.
- Never receives `OPENAI_API_KEY` or raw Agents SDK objects.

### Server

- Validates and normalizes input.
- Runs a reusable `Runner` and `Launch Desk` agent.
- Exposes four strict Zod-backed tools.
- Maps `run_item_stream_event` events into `tool.started` and `tool.completed`.
- Maps raw Responses model deltas into `text.delta`.
- Waits for `stream.completed` before ending the response.
- Uses Agents SDK tracing by default while excluding sensitive trace payloads from this run.

## Project structure

```text
api/agent.js                  Streaming API route
src/agent/launch-agent.js     Agent, model, instructions, reusable Runner
src/agent/tools.js            Agents SDK function tool definitions
src/core/planning.js          Deterministic planning logic used by tools
src/server/sse.js             Stable SSE event adapter
app.js                        Browser stream client and UI state
index.html / styles.css       Frontend
scripts/verify-stream.mjs     Real end-to-end stream verification
scripts/verify-sdk-import.mjs SDK construction check
tests/                        Pure logic and stream-adapter tests
docs/DEVELOPER_NOTES.md       Extension and operations guide
```

## Local setup

1. Install Node.js 20 or newer.
2. Install dependencies:

```bash
npm install
```

3. Create `.env.local`:

```bash
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.6-terra
```

4. Start frontend and backend together through Vercel Dev:

```bash
npm run dev
```

5. Open the printed localhost URL.

The server process—not the browser—must be able to reach `api.openai.com`.

## Commands

```bash
npm test
npm run check
npm run verify:e2e
```

`npm run verify:e2e` makes a real streamed POST request to `http://localhost:3000/api/agent` and fails unless it receives at least one tool event and one model text delta. Override the origin with `LAUNCH_DESK_URL`.

## Model policy

The default is `gpt-5.6-terra`, selected for a balance of intelligence and cost. Override it with `OPENAI_MODEL`. Evaluate `gpt-5.6-sol` for higher-stakes, deeply constrained launches and `gpt-5.6-luna` for high-volume, bounded planning tasks before routing production traffic.

## Tracing

Agents SDK tracing is enabled by default in Node.js. Set `OPENAI_AGENTS_DISABLE_TRACING=1` only when required by privacy or retention policy. This app sets `traceIncludeSensitiveData: false` for launch runs.

## Validation checklist

### Agent behavior
- [ ] The agent calls each of the four launch tools.
- [ ] The final output contains all six required sections.
- [ ] P0 items distinguish launch blockers from post-launch improvements.
- [ ] Risks include probability, impact, mitigation, trigger, and owner role.
- [ ] Missing inputs produce explicit assumptions and follow-up questions.
- [ ] Copy avoids unsupported claims.

### Frontend flow
- [ ] Invalid input is blocked before the request.
- [ ] The UI shows connecting/working/completed/error states.
- [ ] Tool cards move from waiting to running to complete.
- [ ] Model text appears progressively.
- [ ] Stop run cancels the browser request.
- [ ] Copy copies the complete plan.

### End-to-end
- [ ] `OPENAI_API_KEY` is present only on the server.
- [ ] `npm run verify:e2e` receives a tool event.
- [ ] `npm run verify:e2e` receives a model text delta.
- [ ] The stream emits exactly one terminal event.
- [ ] Agents traces appear in the OpenAI dashboard when tracing is enabled.
