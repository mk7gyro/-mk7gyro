import { DEFAULT_VOICE, REALTIME_MODEL, TRANSCRIPTION_MODEL, VOICES, WORLD_STYLES } from "./config.js";
import { buildWorldInstructions } from "./instructions.js";

export function validateSessionRequest(value) {
  const worldSeed = typeof value?.worldSeed === "string" ? value.worldSeed.trim() : "";
  const style = typeof value?.style === "string" ? value.style.trim() : "";
  const voice = typeof value?.voice === "string" ? value.voice.trim() : DEFAULT_VOICE;
  if (worldSeed.length < 8 || worldSeed.length > 1200) {
    return { ok: false, message: "World seed must contain between 8 and 1200 characters." };
  }
  if (!WORLD_STYLES.includes(style)) {
    return { ok: false, message: "Choose a supported creative mode." };
  }
  if (!VOICES.includes(voice)) {
    return { ok: false, message: "Choose a supported voice." };
  }
  return { ok: true, data: { worldSeed, style, voice } };
}

export function buildClientSecretRequest(input) {
  return {
    session: {
      type: "realtime",
      model: REALTIME_MODEL
    }
  };
}

export function publicSessionConfig(input, secret) {
  return {
    value: secret.value,
    expiresAt: secret.expires_at || secret.expiresAt || null,
    model: REALTIME_MODEL,
    transcriptionModel: TRANSCRIPTION_MODEL,
    voice: input.voice,
    instructions: buildWorldInstructions(input)
  };
}
