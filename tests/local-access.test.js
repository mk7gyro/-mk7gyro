import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("local HTTP server enforces access before parsing request bodies", { timeout: 10_000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const accessCode = "a".repeat(43);
  const child = spawn(process.execPath, ["--import", "./tests/helpers/no-upstream.mjs", "src/server/local.js"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { PORT: String(port), PUBLIC_ORIGIN: origin, REALTIME_ACCESS_TOKEN: accessCode, OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  });
  await once(child.stdout, "data");
  assert.match(output, new RegExp(`127\\.0\\.0\\.1:${port}`));

  const endpoint = `${origin}/api/session`;
  const headers = { Origin: origin, Authorization: `Bearer ${accessCode}`, "Content-Type": "application/json" };
  const scenarios = [
    { method: "GET", expected: 405 },
    { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "malformed JSON", expected: 401 },
    { method: "POST", headers: { ...headers, Origin: "https://other.example" }, body: "malformed JSON", expected: 403 },
    { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "malformed JSON", expected: 415 },
    { method: "POST", headers, body: "{}", expected: 500 }
  ];
  for (const { expected, ...options } of scenarios) {
    const response = await fetch(endpoint, options);
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(JSON.stringify(body).includes(accessCode), false);
  }
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).apiKeyConfigured, false);
  assert.equal(output.includes("UNEXPECTED_UPSTREAM_REQUEST"), false);
});
