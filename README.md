# World Room

World Room is a voice-first creative companion for inventing fictional settings, characters, conflicts, and scene hooks. It uses the OpenAI Realtime API over WebRTC for low-latency audio input and output.

## Architecture

### Browser responsibilities

- Requests microphone permission with `getUserMedia`.
- Creates the `RTCPeerConnection`, local microphone track, remote audio element, and Realtime data channel.
- Fetches a short-lived client secret from `/api/token`.
- Exchanges SDP directly with `https://api.openai.com/v1/realtime/calls` using that ephemeral credential.
- Renders microphone, connection, speaking, listening, and transcript states.
- Handles mute, cancellation through session close, and bounded connection recovery.

### Server responsibilities

- Keeps `OPENAI_API_KEY` server-only.
- Creates short-lived Realtime client secrets through `/v1/realtime/client_secrets`.
- Owns the trusted session configuration: model, voice, worldbuilding instructions, transcription model, and VAD settings.
- Adds a privacy-preserving anonymous safety identifier.
- Applies a timeout and returns sanitized errors without exposing upstream credentials or response bodies.

## Local setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local`:

   ```bash
   OPENAI_API_KEY=your_server_side_key
   ```

4. Start the Vercel development server:

   ```bash
   npm run dev
   ```

5. Open the localhost URL printed by Vercel, select **Open the room**, and allow microphone access.

Microphone access requires HTTPS or localhost. Never put `OPENAI_API_KEY` in `app.js`, `index.html`, public environment variables, or browser storage.

## Optional configuration

```bash
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

The default voice is selected before the first audio response and should not be changed during a live session.

## Commands

```bash
npm run dev
npm test
npm run check
```

## Validation checklist

- [ ] The page loads without an API key in the browser bundle or network responses.
- [ ] Denying microphone permission produces a useful error and leaves the room closed.
- [ ] Granting permission opens a WebRTC session and plays the opening greeting.
- [ ] The UI moves through listening, thinking, and speaking states.
- [ ] User and assistant transcripts appear for normal turns.
- [ ] The microphone mute control stops sending live speech.
- [ ] Speaking over the assistant interrupts it without requiring a manual stop button.
- [ ] Closing the room stops microphone tracks and resets the timer.
- [ ] A temporary network interruption triggers bounded recovery rather than an infinite reconnect loop.
- [ ] Typed sparks produce spoken responses.
- [ ] The companion asks concise, useful worldbuilding questions and preserves established canon.

See [`docs/DEVELOPER_NOTES.md`](docs/DEVELOPER_NOTES.md) for session lifecycle, latency, permissions, and recovery details.
