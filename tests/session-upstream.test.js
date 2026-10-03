import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createSessionHandler } from "../api/session.js";

const environment = {
  PUBLIC_ORIGIN: "https://room.example",
  REALTIME_ACCESS_TOKEN: "a".repeat(43),
  OPENAI_API_KEY: "synthetic-server-key"
};
const intake = { worldSeed: "A city that sails through the clouds.", style: "Mythic and luminous", voice: "marin" };

async function localUpstream(t, respond) {
  const server = createServer(respond);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}/client_secrets`;
}

async function mint({ endpoint, upstreamTimeoutMs, capture }) {
  const handler = createSessionHandler({
    environment,
    upstreamTimeoutMs,
    fetchImpl: (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/realtime/client_secrets");
      capture?.(options);
      // Exercise real fetch semantics against a loopback fixture only.
      return fetch(endpoint, options);
    }
  });
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler({
    method: "POST",
    headers: { origin: environment.PUBLIC_ORIGIN, authorization: `Bearer ${environment.REALTIME_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: intake
  }, res);
  return res;
}

test("an upstream redirect cannot forward the server credential or mint a token", { timeout: 3_000 }, async (t) => {
  const paths = [];
  const endpoint = await localUpstream(t, (req, res) => {
    paths.push(req.url);
    if (req.url === "/client_secrets") {
      res.writeHead(307, { Location: "/redirected" });
      res.end();
      return;
    }
    res.end(JSON.stringify({ value: "ek_should_not_be_received" }));
  });
  const result = await mint({ endpoint });
  assert.equal(result.statusCode, 502);
  assert.equal(result.body.error, "realtime_unreachable");
  assert.deepEqual(paths, ["/client_secrets"]);
  assert.equal(JSON.stringify(result.body).includes(environment.OPENAI_API_KEY), false);
});

test("an unresponsive upstream is aborted before headers arrive", { timeout: 3_000 }, async (t) => {
  const endpoint = await localUpstream(t, () => {});
  let signal;
  const result = await mint({ endpoint, upstreamTimeoutMs: 100, capture: (options) => { signal = options.signal; } });
  assert.equal(signal.aborted, true);
  assert.equal(result.statusCode, 502);
  assert.equal(result.body.error, "realtime_unreachable");
});

test("the upstream deadline also covers an unfinished JSON response body", { timeout: 3_000 }, async (t) => {
  const endpoint = await localUpstream(t, (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.flushHeaders();
    res.write('{"value":');
  });
  let signal;
  const result = await mint({ endpoint, upstreamTimeoutMs: 100, capture: (options) => { signal = options.signal; } });
  assert.equal(signal.aborted, true);
  assert.equal(result.statusCode, 502);
  assert.equal(result.body.error, "realtime_session_failed");
});
