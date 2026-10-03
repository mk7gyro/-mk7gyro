import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// This is an application-state regression test, not a microphone or SDK test.
// It imports no third-party packages and makes no network requests.
const sourcePath = fileURLToPath(new URL("../src/client/main.js", import.meta.url));

function createElement() {
  const attributes = new Map();
  return {
    dataset: {},
    hidden: false,
    disabled: false,
    value: "",
    textContent: "",
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    querySelector() { return this; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

function createClientHarness() {
  const source = readFileSync(sourcePath, "utf8");
  const sdkImport = /^import\s+\{\s*RealtimeAgent,\s*RealtimeSession\s*\}\s+from\s+["']@openai\/agents\/realtime["'];?\r?\n/;
  assert.match(source, sdkImport, "Review the test harness if the SDK import changes.");

  const elements = new Map();
  const document = {
    body: createElement(),
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; }
  };
  const unexpectedOperation = () => {
    throw new Error("The client mute regression must not create a live session or use networking.");
  };
  const context = vm.createContext({
    document,
    window: { addEventListener() {} },
    console: { error() {} },
    fetch: unexpectedOperation,
    RealtimeAgent: unexpectedOperation,
    RealtimeSession: unexpectedOperation
  });

  // Remove only the known SDK import in memory; the source file is unchanged.
  vm.runInContext(source.replace(sdkImport, ""), context, {
    filename: sourcePath,
    timeout: 1_000
  });
  const client = vm.runInContext(`({
    bindSessionEvents,
    toggleMute,
    setSession(value) { session = value; },
    snapshot() {
      return {
        muted,
        state: document.body.dataset.session,
        label: orbLabel.textContent,
        status: statusText.textContent
      };
    }
  })`, context, { timeout: 1_000 });

  return client;
}

function bindMockSession(client, mute) {
  const events = new Map();
  const session = {
    on(name, handler) { events.set(name, handler); },
    mute
  };
  client.setSession(session);
  client.bindSessionEvents(session);
  return {
    emit(name) {
      const handler = events.get(name);
      assert.equal(typeof handler, "function", `Missing session handler: ${name}`);
      handler();
    }
  };
}

test("a failed mute cannot become a paused-microphone display after audio stops", async () => {
  const client = createClientHarness();
  const requestedStates = [];
  const session = bindMockSession(client, async (nextMuted) => {
    requestedStates.push(nextMuted);
    throw new Error("Synthetic mute failure");
  });

  await client.toggleMute();
  const afterFailure = client.snapshot();
  session.emit("audio_stopped");
  const afterAudioStopped = client.snapshot();

  assert.deepEqual(requestedStates, [true]);
  assert.equal(afterFailure.state, "error", "The synthetic failure must reach the error handler.");
  assert.equal(afterFailure.muted, false, "A failed operation must not commit the requested mute state.");
  assert.equal(afterAudioStopped.muted, false);
  assert.equal(afterAudioStopped.state, "listening");
  assert.equal(afterAudioStopped.label, "Listening");
  assert.equal(afterAudioStopped.status, "Listening");
});

test("a successful mute still shows the microphone as paused after audio stops", async () => {
  const client = createClientHarness();
  const requestedStates = [];
  const session = bindMockSession(client, async (nextMuted) => {
    requestedStates.push(nextMuted);
  });

  await client.toggleMute();
  session.emit("audio_stopped");
  const result = client.snapshot();

  assert.deepEqual(requestedStates, [true]);
  assert.equal(result.muted, true);
  assert.equal(result.state, "listening");
  assert.equal(result.label, "Microphone paused");
  assert.equal(result.status, "Microphone paused");
});
