# World Room developer notes

## Why WebRTC

For a browser speech-to-speech product, WebRTC is the preferred Realtime transport. It gives the SDK direct access to microphone and remote audio tracks, lower interaction latency than a server-relayed audio pipeline, built-in interruption behavior, and fewer custom buffering concerns. Use WebSocket only when the server must own audio capture or playback.

## Session lifecycle

1. User gesture starts the flow. This is required for reliable browser microphone and audio playback permission.
2. Browser posts creative settings to `/api/session` with the user's private room code in the Authorization header. The field is cleared when the session request starts; the code is not persisted in application browser storage.
3. Server creates a fresh short-lived client secret with the permanent API key.
4. Browser constructs the agent and session before calling `connect()`.
5. The WebRTC transport opens, applies the initial session configuration, and begins audio capture.
6. History events update transcripts asynchronously.
7. `close()` ends the transport and releases media resources.

Create a new token for every reconnect. Do not cache client secrets. A Realtime session is currently limited to 60 minutes, so long-running products should warn the user and perform a deliberate handoff to a new session before that limit.

## Latency

- Keep reasoning effort low for conversational worldbuilding. Raise it only when the product explicitly accepts slower turns.
- Use semantic VAD with medium eagerness as the default. Higher eagerness feels faster but can split reflective speech; lower eagerness tolerates pauses but delays responses.
- Avoid server proxying of live audio. The server should mint the token, then leave the media path between browser and OpenAI.
- Keep spoken instructions concise. Very long system instructions increase setup and generation overhead.
- Audio output can begin before the final transcript is available. The UI must not use transcript completion as its speaking indicator.
- Input transcription is asynchronous and is an aid for display, not an exact record of what the model heard.

## Microphone permissions

`getUserMedia` requires a secure context. Browsers generally treat localhost as secure for development, while production must use HTTPS. The deployment header must allow `microphone=(self)`. Permission denial should not be retried in a loop; instruct the user to restore access in browser settings and press start again.

On iOS, keep session start inside a direct click/tap handler. Backgrounding Safari can suspend media and WebRTC. Treat visibility changes and connection errors as reasons to offer a clean restart rather than silently reconnecting with an old token.

## Error recovery

- Token 401: the server API key is invalid or unavailable.
- Token 429: apply bounded retry/backoff and show a capacity message.
- WebRTC negotiation or ICE failure: close the old session, request a new token, and rebuild the session.
- Microphone denial: preserve the seed and settings, show permission instructions, and wait for a new user gesture.
- Mid-response network loss: close local resources immediately and retain the transcript already received.
- Transcript gaps after interruption are expected; interrupted output may not receive a final transcript.

Never attempt to reconnect with the same ephemeral token after a failed or closed connection.

## Session access boundary

The token route denies access unless the server has a generated `REALTIME_ACCESS_TOKEN` and exact `PUBLIC_ORIGIN`. The access code is separate from `OPENAI_API_KEY`; it grants use of the room and must be protected. Authorization, matching Origin and application/json are required before the upstream call. The local server also checks these conditions before reading the request body and binds only to 127.0.0.1. HTTP origins are limited to that local address; deployments use HTTPS.

Origin is not authentication: non-browser clients can supply it. The shared code protects a private demo, not individual identities. Use server-verified identity-provider sessions for a public or multi-user service. Deployment Protection and WAF rate limiting are external controls to configure and verify; no process-local counter is presented as a distributed quota or billing cap. `npm test` uses injected responses and performs no live API call.

## Audio and transcript UI

Use `audio_start`, `audio_stopped`, `audio_interrupted`, `agent_start`, `agent_end`, and transport events for immediate state. Use `history_updated` for durable transcript rendering. This separates low-latency state indicators from asynchronous transcription.

The default session uses audio output only. Realtime audio output still provides transcripts, so a separate text output modality is unnecessary for the transcript panel.

## Extending World Room

- Add a new creative mode in `src/realtime/config.js` and the matching `<option>`.
- Adjust canon and collaboration rules in `src/realtime/instructions.js` and the browser instruction builder.
- Add local Realtime tools only for non-sensitive browser actions. Tools run where `RealtimeSession` runs.
- For privileged tools, create a thin browser tool that calls a protected backend route.
- Add image input with `session.addImage()` when visual inspiration becomes a product requirement.
- Add a backend continuity service only after defining retention, authentication, and consent. Do not store audio or transcripts by default.
