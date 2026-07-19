# World Room

World Room is a full-stack realtime audio experience for collaborative worldbuilding. The user opens a WebRTC voice session, speaks naturally, interrupts the companion, and watches a transcript accumulate while inventing settings, characters, conflicts, secrets, and scene hooks.

## Current OpenAI architecture

World Room uses the current browser-first OpenAI Realtime pattern:

1. The browser sends the chosen world seed, creative mode, and voice to `POST /api/session`.
2. The server uses `OPENAI_API_KEY` to call `POST /v1/realtime/client_secrets` and returns only the short-lived `ek_...` token plus non-secret session configuration.
3. The browser creates a `RealtimeAgent` and `RealtimeSession` from `@openai/agents/realtime`.
4. `session.connect({ apiKey: ephemeralToken })` establishes a WebRTC speech-to-speech connection. The SDK manages microphone capture, remote audio playback, interruptions, session history, and Realtime event normalization.

The default model is `gpt-realtime-2.1`, with `gpt-realtime-whisper` for input transcription. Output is audio-first; transcripts are read from the SDK's synchronized conversation history.

No permanent OpenAI credential is bundled into the browser. This is not a request/response text loop and does not use Chat Completions or the Assistants API.

## Product behavior

- Low-latency microphone input and generated audio output
- Semantic voice activity detection with automatic response creation
- Barge-in and explicit interruption
- Mute/unmute without ending the session
- Transcript display for both user and companion turns
- Playful “spark” controls for characters, conflict, hooks, and sensory details
- Focused microphone, listening, thinking, speaking, error, and disconnected states
- Session timer and clean teardown

## Project structure

```text
api/session.js                    Server-only ephemeral token route
api/health.js                     Configuration-safe health route
src/client/main.js                Browser RealtimeAgent, RealtimeSession, and UI
src/realtime/config.js            Model, transcription model, styles, and voices
src/realtime/instructions.js      Worldbuilding companion instructions
src/realtime/session-token.js     Request validation and token payload helpers
src/server/http.js                Safe JSON and upstream error helpers
src/server/local.js               Local static and API development server
scripts/verify-sdk.mjs            Realtime SDK construction smoke test
scripts/verify-session.mjs        Real ephemeral-token endpoint verification
tests/                             Deterministic validation and instruction tests
docs/DEVELOPER_NOTES.md           Latency, lifecycle, permission, and recovery notes
```

## Requirements

- Node.js 20–22
- A modern browser with WebRTC and `getUserMedia`
- HTTPS in production; localhost is accepted by browsers for microphone development
- An OpenAI API project with access to `gpt-realtime-2.1`

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set the server-side key:

```env
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_REALTIME_DEFAULT_VOICE=marin
```

Do not use `VITE_`, `NEXT_PUBLIC_`, or another public environment-variable prefix for the permanent key.

Start the local server and frontend bundle:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`, allow microphone access, and press **Open World Room**.

## Commands

```bash
npm test
npm run check
npm run build
npm run verify:session
```

`npm run verify:session` makes a real POST to the local token route and fails unless it receives a short-lived `ek_` client token. It requires the local server to be running with `OPENAI_API_KEY` configured. Audio/WebRTC still requires a real browser because command-line environments cannot grant microphone permission or play the remote track.

## Client/server boundary

### Browser

- Requests microphone permission.
- Creates and maintains the WebRTC connection through `RealtimeSession`.
- Captures user audio and plays model audio.
- Renders local session history transcripts.
- Controls mute, interruption, creative sparks, and session teardown.
- Holds only a short-lived Realtime client secret.

### Server

- Owns `OPENAI_API_KEY`.
- Validates the requested seed, style, and voice.
- Calls the Realtime client-secrets endpoint.
- Returns a fresh ephemeral token for each session.
- Logs only request IDs and safe upstream error codes, not the permanent key.

## Configuration

- Realtime model: `OPENAI_REALTIME_MODEL` or `src/realtime/config.js`
- Transcription model: `OPENAI_REALTIME_TRANSCRIPTION_MODEL`
- Default voice: `OPENAI_REALTIME_DEFAULT_VOICE`
- Supported voice choices: `src/realtime/config.js`
- Agent behavior: `src/realtime/instructions.js` and `buildInstructions()` in the client
- VAD and reasoning effort: `src/client/main.js` inside `RealtimeSession` configuration
- CSP and microphone permissions policy: `vercel.json`

A Realtime model cannot be changed after a session starts, and the voice cannot be changed after the first audio output. End the session and create a new one when either setting changes.

## Deployment

The repository is configured for Vercel:

1. Import the repository.
2. Add `OPENAI_API_KEY` to Preview and Production.
3. Optionally add the model, transcription, and default-voice variables.
4. Deploy.
5. Confirm `/api/health` reports `apiKeyConfigured: true`.
6. Run `WORLD_ROOM_SESSION_URL=https://your-host/api/session npm run verify:session`.
7. Open the HTTPS site in a real browser and complete the audio validation checklist below.

## Validation checklist

### Audio permissions

- [ ] First start prompts for microphone access.
- [ ] Allowing permission opens the room and changes the UI to listening.
- [ ] Denying permission produces a clear recovery message.
- [ ] The app works after permission is restored in browser settings and the session is restarted.
- [ ] Production is served over HTTPS with `Permissions-Policy: microphone=(self)`.

### Realtime connection and recovery

- [ ] `/api/session` returns an `ek_` token and never returns an `sk_` key.
- [ ] WebRTC connects using `gpt-realtime-2.1`.
- [ ] Closing the session releases the microphone indicator.
- [ ] Muting stops microphone transmission without closing the session.
- [ ] Interrupt stops current output and the companion follows the new direction.
- [ ] Network loss produces an error state rather than a frozen microphone state.
- [ ] A new session can be opened after disconnect or failure.
- [ ] A session is deliberately restarted before the Realtime API's 60-minute limit.

### Transcript and conversation quality

- [ ] User speech produces an approximate input transcript.
- [ ] Companion audio produces a readable assistant transcript.
- [ ] Transcript ordering remains understandable when transcription arrives late.
- [ ] The companion keeps spoken turns concise and asks one focused question.
- [ ] Established names, places, rules, and conflicts remain consistent across turns.
- [ ] Creative spark buttons influence the next spoken response without replacing voice as the main interaction.
- [ ] The companion responds naturally to interruption and correction.

### Mobile and accessibility

- [ ] Controls remain usable on iOS Safari and Android Chrome.
- [ ] Listening, thinking, speaking, muted, and error states are conveyed by text as well as animation.
- [ ] Reduced-motion users can still understand state changes.
- [ ] Audio does not start before the user initiates the session.
