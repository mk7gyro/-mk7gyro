// The child HTTP integration server must never make a live upstream request.
globalThis.fetch = async () => {
  console.error("UNEXPECTED_UPSTREAM_REQUEST");
  throw new Error("Upstream networking is disabled in HTTP integration tests.");
};
