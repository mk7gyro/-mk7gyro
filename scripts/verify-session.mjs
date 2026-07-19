const endpoint = process.env.WORLD_ROOM_SESSION_URL || "http://127.0.0.1:3000/api/session";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
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
