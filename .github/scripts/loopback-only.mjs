// Build and test verification may use local HTTP fixtures, never live providers.
import net from "node:net";

const loopback = (host) => ["127.0.0.1", "::1", "[::1]"].includes(host);
function deny() {
  throw new Error("External networking is disabled during build and test verification.");
}

const nativeFetch = globalThis.fetch;
globalThis.fetch = (...args) => {
  const candidate = typeof args[0] === "object" && args[0]?.url ? args[0].url : args[0];
  if (!loopback(new URL(candidate).hostname)) deny();
  return nativeFetch(...args);
};

const nativeConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = normalized[0];
  // Unix domain sockets remain available to local build tools.
  if (typeof options === "object" && options?.path) return nativeConnect.apply(this, args);
  if (typeof options === "string" && !/^\d+$/.test(options)) return nativeConnect.apply(this, args);
  const host = typeof options === "object"
    ? options?.host || options?.hostname || "localhost"
    : typeof normalized[1] === "string" ? normalized[1] : "localhost";
  if (!loopback(host)) deny();
  return nativeConnect.apply(this, args);
};
