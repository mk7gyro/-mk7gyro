import test from "node:test";
import assert from "node:assert/strict";
import { createSessionHandler } from "../api/session.js";

// Synthetic credentials used only with injected fetch; no test contacts OpenAI.
const accessCode = "a".repeat(43);
const baseEnv = {
  PUBLIC_ORIGIN: "https://room.example",
  REALTIME_ACCESS_TOKEN: accessCode,
  OPENAI_API_KEY: "synthetic-server-key"
};
const intake = { worldSeed: "A city that sails through the clouds.", style: "Mythic and luminous", voice: "marin" };

async function request({ method = "POST", headers = {}, omitHeaders = [], environment = {}, body = intake, upstream } = {}) {
  const calls = [];
  const handler = createSessionHandler({
    environment: { ...baseEnv, ...environment },
    fetchImpl: async (...args) => {
      calls.push(args);
      return upstream || { ok: true, status: 200, json: async () => ({ value: "ek_synthetic", expires_at: 1234 }) };
    }
  });
  const requestHeaders = { origin: baseEnv.PUBLIC_ORIGIN, authorization: `Bearer ${accessCode}`, "content-type": "application/json", ...headers };
  for (const name of omitHeaders) delete requestHeaders[name];
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler({ method, headers: requestHeaders, body }, response);
  return { ...response, calls };
}

for (const method of ["GET", "PUT", "OPTIONS"]) {
  test(`${method} is rejected before any upstream request`, async () => {
    const result = await request({ method });
    assert.equal(result.statusCode, 405);
    assert.equal(result.headers.Allow, "POST");
    assert.equal(result.calls.length, 0);
  });
}

for (const [name, value] of [["missing", undefined], ["too short", "a".repeat(42)], ["invalid characters", "a".repeat(43) + "!"], ["too long", "a".repeat(129)]]) {
  test(`${name} configured access code fails closed`, async () => {
    const result = await request({ environment: { REALTIME_ACCESS_TOKEN: value } });
    assert.equal(result.statusCode, 503);
    assert.equal(result.calls.length, 0);
  });
}

for (const origin of [undefined, "bad URL", "http://room.example", "https://room.example/path", "https://user:password@room.example", "https://room.example/", "https://room.example?query=1"]) {
  test(`unsafe configured origin ${String(origin)} fails closed`, async () => {
    const result = await request({ environment: { PUBLIC_ORIGIN: origin } });
    assert.equal(result.statusCode, 503);
    assert.equal(result.calls.length, 0);
  });
}

for (const authorization of [undefined, "Bearer " + "b".repeat(43), "Bearer " + "a".repeat(64), "Bearer short", "Basic credentials", [`Bearer ${accessCode}`]]) {
  test(`unauthorized credential shape ${typeof authorization} cannot mint a token`, async () => {
    const result = await request({ headers: { authorization } });
    assert.equal(result.statusCode, 401);
    assert.equal(result.headers["WWW-Authenticate"], 'Bearer realm="World Room"');
    assert.equal(result.calls.length, 0);
  });
}

for (const origin of [undefined, "null", "https://attacker.example", "https://room.example.attacker.example", "https://room.example/", "https://room.example/path", ["https://room.example"]]) {
  test(`non-matching request origin ${typeof origin} is blocked`, async () => {
    const result = await request({ headers: { origin } });
    assert.equal(result.statusCode, 403);
    assert.equal(result.calls.length, 0);
  });
}

for (const contentType of [undefined, "text/plain", "application/x-www-form-urlencoded", ["application/json"]]) {
  test(`unsupported media type ${typeof contentType} is rejected`, async () => {
    const result = await request({ headers: { "content-type": contentType } });
    assert.equal(result.statusCode, 415);
    assert.equal(result.calls.length, 0);
  });
}

test("valid authorized HTTPS request preserves the upstream payload and hides server credentials", async () => {
  const result = await request({ headers: { "content-type": "application/json; charset=utf-8" } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.calls.length, 1);
  const [url, options] = result.calls[0];
  assert.equal(url, "https://api.openai.com/v1/realtime/client_secrets");
  assert.equal(options.headers.Authorization, `Bearer ${baseEnv.OPENAI_API_KEY}`);
  assert.deepEqual(JSON.parse(options.body), { session: { type: "realtime", model: "gpt-realtime-2.1" } });
  assert.equal(result.body.value, "ek_synthetic");
  assert.equal(result.body.expiresAt, 1234);
  assert.equal(result.body.voice, intake.voice);
  assert.match(result.body.instructions, /city that sails/);
  assert.match(result.body.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(result.headers["Cache-Control"], "no-store");
  const serialized = JSON.stringify(result.body);
  assert.equal(serialized.includes(baseEnv.OPENAI_API_KEY), false);
  assert.equal(serialized.includes(accessCode), false);
});

test("explicit 127.0.0.1 development origin remains usable with authentication", async () => {
  const origin = "http://127.0.0.1:3000";
  const result = await request({ environment: { PUBLIC_ORIGIN: origin }, headers: { origin } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.calls.length, 1);
});

test("a different local port is not the configured origin", async () => {
  const result = await request({ environment: { PUBLIC_ORIGIN: "http://127.0.0.1:3000" }, headers: { origin: "http://127.0.0.1:3001" } });
  assert.equal(result.statusCode, 403);
  assert.equal(result.calls.length, 0);
});

test("missing upstream configuration cannot reach an external service", async () => {
  const result = await request({ environment: { OPENAI_API_KEY: undefined } });
  assert.equal(result.statusCode, 500);
  assert.equal(result.calls.length, 0);
});

test("authorized malformed intake is rejected before fetching", async () => {
  const result = await request({ body: { ...intake, voice: "unsupported" } });
  assert.equal(result.statusCode, 400);
  assert.equal(result.calls.length, 0);
});
