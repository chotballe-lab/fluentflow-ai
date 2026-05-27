import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleCoach,
  handleHealth,
  handleRealtimeSession,
  handleTopicContext
} from "./lib/fluentflow-core.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600"
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/realtime/session") {
      return handleRealtimeSession(req, res);
    }
    if (req.method === "POST" && req.url === "/api/topic-context") {
      return handleTopicContext(req, res);
    }
    if (req.method === "POST" && req.url === "/api/coach") {
      return handleCoach(req, res);
    }
    if (req.method === "GET" && req.url === "/api/health") {
      return handleHealth(req, res);
    }
    if (req.method === "GET") {
      return serveStatic(req, res);
    }

    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`FluentFlow AI running at http://localhost:${port}`);
});
