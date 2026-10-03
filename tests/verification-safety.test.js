import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const [name, origin, endpoint] of [
  ["public HTTP", "http://public.example", "http://public.example/api/session"],
  ["another origin", "https://room.example", "https://other.example/api/session"],
  ["another path", "https://room.example", "https://room.example/other"],
  ["URL credentials", "https://room.example", "https://user:password@room.example/api/session"],
  ["URL query", "https://room.example", "https://room.example/api/session?extra=1"]
]) {
  test(`live verification refuses ${name} before sending the access code`, () => {
    const result = spawnSync(process.execPath, ["--import", "./tests/helpers/no-upstream.mjs", "scripts/verify-session.mjs"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { PUBLIC_ORIGIN: origin, WORLD_ROOM_SESSION_URL: endpoint, REALTIME_ACCESS_TOKEN: "a".repeat(43) },
      encoding: "utf8",
      timeout: 5_000
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.equal((result.stdout + result.stderr).includes("UNEXPECTED_UPSTREAM_REQUEST"), false);
    assert.match(result.stderr, /refusing|valid HTTPS/);
  });
}
