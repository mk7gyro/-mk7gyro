export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
export const TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || "gpt-realtime-whisper";

export const VOICES = ["marin", "cedar", "coral", "sage", "shimmer", "verse"];
export const DEFAULT_VOICE = VOICES.includes(process.env.OPENAI_REALTIME_DEFAULT_VOICE)
  ? process.env.OPENAI_REALTIME_DEFAULT_VOICE
  : "marin";

export const WORLD_STYLES = [
  "Mythic and luminous",
  "Strange science fiction",
  "Cozy and uncanny",
  "Dark folklore",
  "Swashbuckling adventure",
  "Dreamlike mystery"
];
