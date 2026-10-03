import { configuredOrigin } from "../src/server/session-access.js";

const endpoint = process.env.WORLD_ROOM_SESSION_URL || "http://127.0.0.1:3000/api/session";
const accessCode = process.env.REALTIME_ACCESS_TOKEN;
const origin = process.env.PUBLIC_ORIGIN;
if (!accessCode || !configuredOrigin(origin)) throw new Error("Set a room access code and a valid HTTPS or explicit 127.0.0.1 PUBLIC_ORIGIN before this live check.");
const target = new URL(endpoint);
if (target.origin !== origin || target.pathname !== "/api/session" || target.search || target.hash || target.username || target.password) {
  throw new Error("Use PUBLIC_ORIGIN's exact /api/session endpoint; refusing to send the room credential elsewhere.");
}
const response = await fetch(endpoint, {
  method: "POST",
  redirect: "error",
  headers: { "Content-Type": "application/json", Origin: origin, Authorization: `Bearer ${accessCode}` },
  body: JSON.stringify({
    worldSeed: "A lighthouse that warns ships away from the future rather than rocks.",
    style: "Dreamlike mystery",
    voice: "marin"
  })
});
const data = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Session endpoint returned ${response.status}: ${JSON.stringify(data)}`);
if (typeof data.value !== "string" || !data.value.startsWith("ek_")) throw new Error("No ephemeral Realtime client token was returned.");
if (data.value.startsWith("sk-")) throw new Error("A permanent API key was exposed.");
console.log(`Realtime token verified: endpoint=${endpoint}, model=${data.model}, voice=${data.voice}, expiresAt=${data.expiresAt || "unknown"}`);
