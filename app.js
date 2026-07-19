const $ = (selector) => document.querySelector(selector);

const elements = {
  connectionPill: $("#connectionPill"),
  connectionLabel: $("#connectionLabel"),
  voiceStage: $("#voiceStage"),
  voiceStateTitle: $("#voiceStateTitle"),
  voiceStateDescription: $("#voiceStateDescription"),
  sessionButton: $("#sessionButton"),
  sessionButtonText: $("#sessionButtonText"),
  muteButton: $("#muteButton"),
  modelLabel: $("#modelLabel"),
  sessionTimer: $("#sessionTimer"),
  transcriptList: $("#transcriptList"),
  emptyState: $("#emptyState"),
  clearButton: $("#clearButton"),
  seedForm: $("#seedForm"),
  seedInput: $("#seedInput"),
  seedButton: $("#seedButton"),
  promptSparks: $("#promptSparks"),
  toast: $("#toast")
};

const uiCopy = {
  offline: ["The room is waiting", "Open the room, allow microphone access, and speak naturally."],
  connecting: ["Opening the room", "Securing a short-lived session and tuning the audio channel…"],
  listening: ["Listening for a spark", "Speak naturally. Pause when you want the world to answer."],
  thinking: ["The world is taking shape", "Connecting your idea to a place, person, conflict, or scene."],
  speaking: ["The room is speaking", "Interrupt at any time—the companion will follow your lead."],
  muted: ["Microphone muted", "Unmute when you are ready to keep building."],
  error: ["The room lost its signal", "Close and reopen the room to start a fresh voice session."]
};

const state = {
  peer: null,
  channel: null,
  mediaStream: null,
  remoteAudio: null,
  audioContext: null,
  analyser: null,
  levelFrame: null,
  connected: false,
  connecting: false,
  muted: false,
  intentionalClose: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  disconnectTimer: null,
  startedAt: null,
  timerInterval: null,
  liveMessages: new Map(),
  toastTimer: null
};

function setVisualState(nextState, descriptionOverride) {
  const [title, description] = uiCopy[nextState] || uiCopy.offline;
  elements.voiceStage.dataset.state = nextState;
  elements.voiceStateTitle.textContent = title;
  elements.voiceStateDescription.textContent = descriptionOverride || description;

  const connectionState = nextState === "error"
    ? "error"
    : nextState === "connecting"
      ? "connecting"
      : state.connected
        ? "online"
        : "offline";

  elements.connectionPill.dataset.state = connectionState;
  elements.connectionLabel.textContent = connectionState === "online"
    ? "Room open"
    : connectionState === "connecting"
      ? "Opening"
      : connectionState === "error"
        ? "Connection lost"
        : "Room closed";
}

function updateControls() {
  elements.sessionButton.disabled = state.connecting;
  elements.sessionButtonText.textContent = state.connecting
    ? "Opening…"
    : state.connected
      ? "Close the room"
      : "Open the room";
  elements.muteButton.disabled = !state.connected;
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute(
    "aria-label",
    state.muted ? "Unmute microphone" : "Mute microphone"
  );
  elements.seedInput.disabled = !state.connected;
  elements.seedButton.disabled = !state.connected;
}

function showToast(message, timeout = 4600) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, timeout);
}

function getAnonymousBrowserId() {
  const storageKey = "world-room-browser-id";
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
  }
  return id;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  stopTimer();
  state.startedAt = Date.now();
  elements.sessionTimer.textContent = "00:00";
  state.timerInterval = setInterval(() => {
    elements.sessionTimer.textContent = formatTime((Date.now() - state.startedAt) / 1000);
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.startedAt = null;
  elements.sessionTimer.textContent = "00:00";
}

function ensureTranscriptVisible() {
  elements.emptyState?.remove();
}

function messageKey(role, id) {
  return `${role}:${id || "live"}`;
}

function upsertMessage(role, id, text, isLive = false) {
  if (!text) return;
  ensureTranscriptVisible();
  const key = messageKey(role, id);
  let entry = state.liveMessages.get(key);

  if (!entry) {
    const root = document.createElement("article");
    root.className = `message${isLive ? " is-live" : ""}`;
    root.dataset.role = role;
    root.innerHTML = `
      <div class="message-label">${role === "user" ? "You" : "World Room"}</div>
      <p class="message-text"></p>
    `;
    elements.transcriptList.append(root);
    entry = { root, text: root.querySelector(".message-text"), content: "" };
    state.liveMessages.set(key, entry);
  }

  entry.content = text;
  entry.text.textContent = text;
  entry.root.classList.toggle("is-live", isLive);
  elements.transcriptList.scrollTop = elements.transcriptList.scrollHeight;
}

function appendMessageDelta(role, id, delta) {
  if (!delta) return;
  const key = messageKey(role, id);
  const existing = state.liveMessages.get(key);
  const next = `${existing?.content || ""}${delta}`;
  upsertMessage(role, id, next, true);
}

function finalizeMessage(role, id, finalText) {
  const key = messageKey(role, id);
  const entry = state.liveMessages.get(key);
  if (finalText) upsertMessage(role, id, finalText, false);
  else entry?.root.classList.remove("is-live");
}

function clearTranscript() {
  state.liveMessages.clear();
  elements.transcriptList.innerHTML = `
    <div class="empty-state" id="emptyState">
      <span class="empty-glyph" aria-hidden="true">◌</span>
      <p>Your shared world will appear here as you speak.</p>
    </div>
  `;
  elements.emptyState = $("#emptyState");
}

function eventIdentity(event, fallback = "live") {
  return event.item_id || event.response_id || event.response?.id || fallback;
}

function handleRealtimeEvent(event) {
  switch (event.type) {
    case "session.created":
    case "session.updated":
      if (event.session?.model) elements.modelLabel.textContent = event.session.model;
      break;

    case "input_audio_buffer.speech_started":
      if (!state.muted) setVisualState("listening", "I can hear you—keep going until the thought feels complete.");
      break;

    case "input_audio_buffer.speech_stopped":
      setVisualState("thinking");
      break;

    case "conversation.item.input_audio_transcription.delta":
      appendMessageDelta("user", eventIdentity(event, "user-live"), event.delta);
      break;

    case "conversation.item.input_audio_transcription.completed":
      finalizeMessage("user", eventIdentity(event, "user-live"), event.transcript);
      break;

    case "response.created":
      setVisualState("thinking");
      break;

    case "response.output_audio_transcript.delta":
      setVisualState("speaking");
      appendMessageDelta("assistant", eventIdentity(event, "assistant-live"), event.delta);
      break;

    case "response.output_audio_transcript.done":
      finalizeMessage("assistant", eventIdentity(event, "assistant-live"), event.transcript);
      break;

    case "response.output_text.delta":
      setVisualState("speaking");
      appendMessageDelta("assistant", eventIdentity(event, "assistant-text"), event.delta);
      break;

    case "response.output_text.done":
      finalizeMessage("assistant", eventIdentity(event, "assistant-text"), event.text);
      break;

    case "response.done":
    case "response.cancelled":
      if (state.connected) setVisualState(state.muted ? "muted" : "listening");
      break;

    case "error": {
      const message = event.error?.message || event.message || "The realtime session reported an error.";
      console.error("Realtime event error", event);
      showToast(message);
      break;
    }

    default:
      break;
  }
}

function sendEvent(event) {
  if (!state.channel || state.channel.readyState !== "open") {
    throw new Error("The voice channel is not ready.");
  }
  state.channel.send(JSON.stringify({
    event_id: crypto.randomUUID(),
    ...event
  }));
}

function sendTypedSeed(text) {
  const trimmed = text.trim();
  if (!trimmed || !state.connected) return;

  const localId = `typed-${crypto.randomUUID()}`;
  upsertMessage("user", localId, trimmed, false);

  sendEvent({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: trimmed }]
    }
  });
  sendEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
  setVisualState("thinking");
  elements.seedInput.value = "";
}

function startLevelMeter(stream) {
  stopLevelMeter();
  state.audioContext = new AudioContext();
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 256;
  source.connect(state.analyser);
  const values = new Uint8Array(state.analyser.frequencyBinCount);

  const draw = () => {
    state.analyser.getByteFrequencyData(values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const normalized = state.muted ? 0 : Math.min(1, average / 92);
    document.documentElement.style.setProperty("--mic-level", normalized.toFixed(3));
    state.levelFrame = requestAnimationFrame(draw);
  };
  draw();
}

function stopLevelMeter() {
  cancelAnimationFrame(state.levelFrame);
  state.levelFrame = null;
  state.audioContext?.close().catch(() => {});
  state.audioContext = null;
  state.analyser = null;
  document.documentElement.style.setProperty("--mic-level", "0");
}

function waitForDataChannel(channel, timeoutMs = 10_000) {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("The realtime channel did not open in time.")), timeoutMs);
    channel.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    channel.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("The realtime data channel failed."));
    }, { once: true });
  });
}

async function requestMicrophone() {
  if (!window.isSecureContext && location.hostname !== "localhost") {
    throw new Error("Microphone access requires HTTPS or localhost.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone capture.");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    }
  });
}

async function fetchSessionToken() {
  const response = await fetch("/api/token", {
    method: "POST",
    headers: { "X-World-Room-User": getAnonymousBrowserId() }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.value) {
    throw new Error(data.message || "A short-lived voice credential could not be created.");
  }
  return data;
}

function installConnectionRecovery(peer) {
  peer.addEventListener("connectionstatechange", () => {
    const connectionState = peer.connectionState;
    if (connectionState === "connected") {
      clearTimeout(state.disconnectTimer);
      state.reconnectAttempts = 0;
      return;
    }

    if ((connectionState === "failed" || connectionState === "disconnected") && !state.intentionalClose) {
      clearTimeout(state.disconnectTimer);
      state.disconnectTimer = setTimeout(() => {
        if (!state.intentionalClose && !state.connecting && state.reconnectAttempts < 2) {
          state.reconnectAttempts += 1;
          showToast(`Voice connection lost. Reopening the room (${state.reconnectAttempts}/2)…`);
          disconnectSession({ preserveIntent: true });
          startSession({ recovery: true });
        } else if (!state.intentionalClose) {
          setVisualState("error");
          updateControls();
        }
      }, connectionState === "disconnected" ? 2500 : 300);
    }
  });
}

async function startSession({ recovery = false } = {}) {
  if (state.connecting || state.connected) return;
  let pendingStream = null;
  state.intentionalClose = false;
  state.connecting = true;
  state.muted = false;
  setVisualState("connecting");
  updateControls();

  try {
    const [token, mediaStream] = await Promise.all([
      fetchSessionToken(),
      requestMicrophone().then((stream) => {
        pendingStream = stream;
        return stream;
      })
    ]);

    const peer = new RTCPeerConnection();
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;

    peer.addEventListener("track", (event) => {
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().catch(() => {
        showToast("Tap the page once to allow audio playback.");
      });
    });

    for (const track of mediaStream.getAudioTracks()) {
      peer.addTrack(track, mediaStream);
    }

    const channel = peer.createDataChannel("oai-events");
    channel.addEventListener("message", (message) => {
      try {
        handleRealtimeEvent(JSON.parse(message.data));
      } catch (error) {
        console.error("Invalid realtime event", error);
      }
    });
    channel.addEventListener("close", () => {
      if (!state.intentionalClose && state.connected) setVisualState("connecting", "The voice channel closed. Attempting to recover…");
    });

    installConnectionRecovery(peer);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${token.value}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!sdpResponse.ok) {
      throw new Error("OpenAI could not establish the realtime audio connection.");
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text()
    });
    await waitForDataChannel(channel);

    state.peer = peer;
    state.channel = channel;
    state.mediaStream = mediaStream;
    state.remoteAudio = remoteAudio;
    state.connected = true;
    state.connecting = false;
    elements.modelLabel.textContent = token.model || "Realtime audio";
    startTimer();
    startLevelMeter(mediaStream);
    setVisualState("listening");
    updateControls();

    sendEvent({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: recovery
          ? "Briefly say the room is open again, then invite the user to continue the last idea or begin a new spark."
          : "Welcome the user in one evocative sentence, then ask for a first spark: a place, person, problem, or mood."
      }
    });
  } catch (error) {
    pendingStream?.getTracks().forEach((track) => track.stop());
    console.error("World Room connection failed", error);
    state.connecting = false;
    disconnectSession({ preserveIntent: true });
    setVisualState("error", error.message);
    updateControls();
    showToast(error.message);
  }
}

function disconnectSession({ preserveIntent = false } = {}) {
  clearTimeout(state.disconnectTimer);
  clearTimeout(state.reconnectTimer);
  if (!preserveIntent) state.intentionalClose = true;

  state.channel?.close();
  state.peer?.close();
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  if (state.remoteAudio) {
    state.remoteAudio.pause();
    state.remoteAudio.srcObject = null;
  }

  state.peer = null;
  state.channel = null;
  state.mediaStream = null;
  state.remoteAudio = null;
  state.connected = false;
  state.connecting = false;
  state.muted = false;
  stopLevelMeter();
  stopTimer();
  if (!preserveIntent) setVisualState("offline");
  updateControls();
}

function toggleMute() {
  if (!state.connected || !state.mediaStream) return;
  state.muted = !state.muted;
  state.mediaStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.muted;
  });
  setVisualState(state.muted ? "muted" : "listening");
  updateControls();
}

elements.sessionButton.addEventListener("click", () => {
  if (state.connected || state.connecting) disconnectSession();
  else startSession();
});

elements.muteButton.addEventListener("click", toggleMute);
elements.clearButton.addEventListener("click", clearTranscript);

elements.seedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    sendTypedSeed(elements.seedInput.value);
  } catch (error) {
    showToast(error.message);
  }
});

elements.promptSparks.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-prompt]");
  if (!button) return;
  const prompt = button.dataset.prompt;
  if (!state.connected) {
    elements.seedInput.value = prompt;
    showToast("Open the room, then send this spark—or simply say it aloud.");
    return;
  }
  try {
    sendTypedSeed(prompt);
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener("beforeunload", () => disconnectSession());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.remoteAudio) state.remoteAudio.volume = 0.85;
});

setVisualState("offline");
updateControls();
