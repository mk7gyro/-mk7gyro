import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const $ = (selector) => document.querySelector(selector);
const form = $("#worldForm");
const startButton = $("#startButton");
const endButton = $("#endButton");
const micButton = $("#micButton");
const interruptButton = $("#interruptButton");
const sampleButton = $("#sampleButton");
const status = $("#sessionStatus");
const statusText = $("#sessionStatusText");
const orb = $("#voiceOrb");
const orbLabel = $("#orbLabel");
const transcript = $("#transcript");
const emptyTranscript = $("#emptyTranscript");
const errorPanel = $("#errorPanel");
const errorText = $("#errorText");
const sessionMeta = $("#sessionMeta");
const sparkButtons = [...document.querySelectorAll("[data-spark]")];

let session = null;
let muted = false;
let connecting = false;
let sessionStartedAt = 0;
let timer = null;
let lastHistorySignature = "";

function setState(state, label) {
  document.body.dataset.session = state;
  status.dataset.state = state;
  statusText.textContent = label;
  orb.dataset.state = state;
  const labels = {
    idle: "Open the room",
    connecting: "Opening a passage…",
    listening: muted ? "Microphone paused" : "Listening",
    thinking: "Imagining",
    speaking: "World Room is speaking",
    error: "Connection lost"
  };
  orbLabel.textContent = labels[state] || label;
}

function setControls(active) {
  startButton.hidden = active;
  endButton.hidden = !active;
  micButton.disabled = !active;
  interruptButton.disabled = !active;
  sparkButtons.forEach((button) => { button.disabled = !active; });
  form.querySelectorAll("textarea, select").forEach((input) => { input.disabled = active; });
}

function showError(message) {
  errorText.textContent = message;
  errorPanel.hidden = false;
  setState("error", "Session error");
}

function hideError() {
  errorPanel.hidden = true;
  errorText.textContent = "";
}

function extractContentText(item) {
  const content = Array.isArray(item?.content) ? item.content : [];
  return content.map((part) => part?.transcript || part?.text || part?.content || "").filter(Boolean).join(" ").trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item?.type === "message" && ["user", "assistant"].includes(item.role))
    .map((item) => ({ id: item.itemId || item.id || crypto.randomUUID(), role: item.role, text: extractContentText(item) }))
    .filter((item) => item.text);
}

function renderHistory(history) {
  const messages = normalizeHistory(history);
  const signature = JSON.stringify(messages.map(({ role, text }) => [role, text]));
  if (signature === lastHistorySignature) return;
  lastHistorySignature = signature;
  transcript.replaceChildren();
  emptyTranscript.hidden = messages.length > 0;
  messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message message-${message.role}`;
    const label = document.createElement("span");
    label.textContent = message.role === "assistant" ? "World Room" : "You";
    const body = document.createElement("p");
    body.textContent = message.text;
    article.append(label, body);
    transcript.append(article);
  });
  transcript.scrollTop = transcript.scrollHeight;
}

function updateTimer() {
  if (!sessionStartedAt) return;
  const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  sessionMeta.textContent = `${minutes}:${seconds} · WebRTC`;
}

function buildInstructions(seed, style) {
  return `You are World Room, a live worldbuilding companion speaking with the user in a playful, vivid voice.

World seed: ${seed}
Creative mode: ${style}

Treat this as collaborative improvisation. Keep spoken turns concise, normally two to five sentences, and ask one focused question at a time. Help invent settings, cultures, characters, conflicts, secrets, sensory details, and scene hooks. Preserve established canon and connect major additions to details already spoken. Offer concrete choices when the user is uncertain without taking control of their world. Use evocative language that is easy to understand aloud. If interrupted, stop gracefully and follow the new direction. Avoid long lists unless asked. Never present fictional material as real history.

Open with one brief sensory image inspired by the seed, then ask what the user wants to discover first.`;
}

async function createSessionToken(payload) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Session request failed with ${response.status}.`);
  return data;
}

function bindSessionEvents(activeSession) {
  activeSession.on("history_updated", (history) => renderHistory(history));
  activeSession.on("history_added", () => {
    if (Array.isArray(activeSession.history)) renderHistory(activeSession.history);
  });
  activeSession.on("audio_start", () => setState("speaking", "Companion speaking"));
  activeSession.on("audio_stopped", () => setState("listening", muted ? "Microphone paused" : "Listening"));
  activeSession.on("audio_interrupted", () => setState("listening", muted ? "Microphone paused" : "Listening"));
  activeSession.on("agent_start", () => setState("thinking", "Shaping the world"));
  activeSession.on("agent_end", () => {
    if (document.body.dataset.session !== "speaking") setState("listening", muted ? "Microphone paused" : "Listening");
  });
  activeSession.on("transport_event", (event) => {
    const type = event?.type || event?.event?.type || event?.data?.type;
    if (type === "input_audio_buffer.speech_started") setState("listening", "You are speaking");
    if (type === "input_audio_buffer.speech_stopped") setState("thinking", "Listening to the idea");
    if (type === "response.created") setState("thinking", "Imagining");
  });
  activeSession.on("error", (error) => {
    console.error("Realtime session error", error);
    showError(error?.message || error?.error?.message || "The realtime connection encountered an error.");
  });
}

async function startSession() {
  if (connecting || session) return;
  if (!form.reportValidity()) return;
  hideError();
  connecting = true;
  setState("connecting", "Requesting microphone");
  startButton.disabled = true;

  const worldSeed = $("#worldSeed").value.trim();
  const style = $("#style").value;
  const voice = $("#voice").value;

  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error("This browser does not support the microphone and WebRTC features required by World Room.");
    }
    const token = await createSessionToken({ worldSeed, style, voice });
    const agent = new RealtimeAgent({
      name: "World Room",
      voice: token.voice,
      instructions: token.instructions || buildInstructions(worldSeed, style)
    });
    const activeSession = new RealtimeSession(agent, {
      model: token.model,
      workflowName: "World Room voice session",
      tracingDisabled: true,
      historyStoreAudio: false,
      config: {
        outputModalities: ["audio"],
        reasoning: { effort: "low" },
        audio: {
          input: {
            transcription: { model: token.transcriptionModel },
            turnDetection: {
              type: "semantic_vad",
              eagerness: "medium",
              createResponse: true,
              interruptResponse: true
            }
          },
          output: { voice: token.voice }
        }
      }
    });
    bindSessionEvents(activeSession);
    session = activeSession;
    setState("connecting", "Connecting with WebRTC");
    await activeSession.connect({ apiKey: token.value });
    muted = false;
    setControls(true);
    micButton.setAttribute("aria-pressed", "true");
    micButton.querySelector("strong").textContent = "Microphone live";
    sessionStartedAt = Date.now();
    timer = window.setInterval(updateTimer, 1000);
    updateTimer();
    setState("listening", "Room open");
    activeSession.sendMessage("Open the World Room now with the brief invitation described in your instructions.");
  } catch (error) {
    console.error(error);
    await endSession(false);
    const denied = error?.name === "NotAllowedError" || /permission|microphone/i.test(error?.message || "");
    showError(denied ? "Microphone access was denied. Allow microphone permission in the browser, then try again." : error.message);
  } finally {
    connecting = false;
    startButton.disabled = false;
  }
}

async function endSession(resetState = true) {
  window.clearInterval(timer);
  timer = null;
  sessionStartedAt = 0;
  sessionMeta.textContent = "Not connected";
  const active = session;
  session = null;
  if (active) {
    try {
      active.close();
    } catch {
      try { active.transport?.close(); } catch { /* no-op */ }
    }
  }
  muted = false;
  setControls(false);
  micButton.setAttribute("aria-pressed", "false");
  micButton.querySelector("strong").textContent = "Microphone";
  if (resetState) setState("idle", "Ready to open");
}

async function toggleMute() {
  if (!session) return;
  try {
    muted = !muted;
    await session.mute(muted);
    micButton.setAttribute("aria-pressed", String(!muted));
    micButton.querySelector("strong").textContent = muted ? "Microphone paused" : "Microphone live";
    setState("listening", muted ? "Microphone paused" : "Listening");
  } catch (error) {
    showError(error.message || "The microphone state could not be changed.");
  }
}

function interrupt() {
  if (!session) return;
  session.interrupt();
  setState("listening", muted ? "Microphone paused" : "Interrupted · listening");
}

function sendSpark(prompt) {
  if (!session) return;
  session.sendMessage(prompt);
  setState("thinking", "Following the spark");
}

form.addEventListener("submit", (event) => { event.preventDefault(); startSession(); });
endButton.addEventListener("click", () => endSession());
micButton.addEventListener("click", toggleMute);
interruptButton.addEventListener("click", interrupt);
sparkButtons.forEach((button) => button.addEventListener("click", () => sendSpark(button.dataset.spark)));
sampleButton.addEventListener("click", () => {
  $("#worldSeed").value = "An ocean planet where cities migrate on the backs of ancient glass-shelled leviathans, and one city has just stopped moving.";
  $("#style").value = "Strange science fiction";
  $("#voice").value = "marin";
});
window.addEventListener("beforeunload", () => { try { session?.close(); } catch { /* no-op */ } });

setControls(false);
setState("idle", "Ready to open");
