import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const agent = new RealtimeAgent({
  name: "World Room verification",
  voice: "marin",
  instructions: "Help the user invent a fictional world in concise spoken turns."
});
const session = new RealtimeSession(agent, {
  model: "gpt-realtime-2.1",
  tracingDisabled: true,
  config: {
    outputModalities: ["audio"],
    reasoning: { effort: "low" },
    audio: {
      input: {
        transcription: { model: "gpt-realtime-whisper" },
        turnDetection: { type: "semantic_vad", eagerness: "medium", createResponse: true, interruptResponse: true }
      },
      output: { voice: "marin" }
    }
  }
});

if (typeof session.connect !== "function" || typeof session.mute !== "function" || typeof session.interrupt !== "function" || typeof session.close !== "function") {
  throw new Error("The installed Agents SDK does not expose the expected RealtimeSession browser lifecycle.");
}
console.log("Realtime SDK ready: model=gpt-realtime-2.1, transport=browser WebRTC, voice=marin");
session.close();
