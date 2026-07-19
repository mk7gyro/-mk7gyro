import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson } from "./http.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const port = Number.parseInt(process.env.PORT || "3000", 10);

function loadLocalEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!(key in process.env)) process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();

const [{ default: agentHandler }, { default: healthHandler }] = await Promise.all([
  import("../../api/agent.js"),
  import("../../api/health.js")
]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!["index.html", "app.js", "styles.css"].includes(safe)) return false;
  const file = join(root, safe);
  if (!existsSync(file)) return false;
  res.statusCode = 200;
  res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.end(readFileSync(file));
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${port}`}`);
  try {
    if (url.pathname === "/api/agent") {
      if (req.method === "POST") req.body = await readJson(req);
      return agentHandler(req, res);
    }
    if (url.pathname === "/api/health") return healthHandler(req, res);
    if (serveStatic(req, res, url.pathname)) return;
    return sendJson(res, 404, { error: "not_found", message: "Route not found." });
  } catch (error) {
    console.error("Local server request failed", error);
    if (!res.headersSent) return sendJson(res, 400, { error: "bad_request", message: error.message });
    if (!res.writableEnded) res.end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Launch Desk local server: http://127.0.0.1:${port}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "configured" : "missing"}`);
});
