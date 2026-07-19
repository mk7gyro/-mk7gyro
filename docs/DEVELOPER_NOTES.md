# World Room developer notes

## Realtime transport

World Room uses WebRTC rather than a request/response text loop. The microphone and model audio travel on WebRTC media tracks; control and transcript events travel on the `oai-events` data channel.

The browser receives only a short-lived client secret. `OPENAI_API_KEY` remains in the serverless function and is used only to call `/v1/realtime/client_secrets`.

## Latency

- WebRTC is preferred for browser speech-to-speech because it handles realtime media and uncertain client networks more robustly than manually moving audio through a WebSocket.
- Semantic VAD is enabled with automatic response creation and interruption. Test `eagerness` with real speakers before changing it.
- The browser requests echo cancellation, noise suppression, and automatic gain control. Browser implementations vary, so test physical devices.
- Keep spoken responses short. Prompting for concise turns reduces time to completion and makes interruptions feel natural.
- The token request and microphone permission request run concurrently to reduce startup latency.
- Avoid adding application-server audio relays unless product requirements require recording, telephony, or server-side media processing.

## Session lifecycle

1. User clicks **Open the room**.
2. The browser requests a microphone stream and calls `POST /api/token` in parallel.
3. The server mints a client secret using the trusted session configuration.
4. The browser creates an SDP offer and posts it to `/v1/realtime/calls` with the ephemeral credential.
5. The browser installs the SDP answer and waits for the data channel to open.
6. World Room sends an initial `response.create` event for the spoken welcome.
7. Semantic VAD commits speech turns and creates responses automatically.
8. Closing the room closes the data channel and peer connection, stops all microphone tracks, stops the meter, and resets the timer.

Realtime sessions are bounded in duration by the service. For longer creative sessions, add a visible renewal warning and explicitly summarize canon into a new session rather than silently reconnecting and losing context.

## Permissions

- Microphone capture works on HTTPS and localhost.
- Permission denial is handled as a closed-room error; the user must change the browser permission and retry.
- `Permissions-Policy: microphone=(self)` limits capture to this origin.
- Do not request microphone access on page load. The explicit button provides the required user gesture and context.
- On iOS, audio autoplay can still require interaction. The connection starts from a user click and includes a fallback message when `audio.play()` is blocked.

## Transcript handling

- Assistant text is built from `response.output_audio_transcript.delta` and finalized on the corresponding done event.
- User transcription is reconciled by `item_id` because completion ordering between turns is not guaranteed.
- Transcript text is kept in the page only. Add storage only after a product/privacy decision.
- Transcription is auxiliary; audio interaction remains the product's source of truth.

## Error recovery

- The token endpoint has an 8-second upstream timeout and returns sanitized errors.
- The browser waits up to 10 seconds for the data channel.
- Failed or sustained disconnected peer states trigger at most two fresh-session attempts.
- Recovery creates a new session and does not automatically restore previous Realtime conversation state. The UI tells the user the room reopened.
- Authentication, permission denial, unsupported browser APIs, and repeated network failures require manual user action.
- Never retry indefinitely; repeated token minting and audio sessions create cost and can hide outages.

## Production decisions before public launch

- Add application authentication or rate limiting to `/api/token`.
- Replace the anonymous browser identifier with a stable, privacy-preserving hash of an authenticated internal user ID where available.
- Define transcript retention, logging, and analytics policies.
- Add operational metrics for token failures, WebRTC connection time, reconnect rate, session duration, and conversation quality.
- Verify target browsers, headsets, languages, accents, background noise, and mobile lock-screen behavior.
- Decide whether to pin a Realtime model snapshot or follow the alias after completing voice-quality evaluations.
