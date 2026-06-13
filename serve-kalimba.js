const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const host = "0.0.0.0";
const port = 8123;
const rootDir = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function getLanUrls() {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}/index.html`);
      }
    });
  });

  return urls;
}

const server = http.createServer((req, res) => {
  let requested = "/";
  try {
    requested = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch (error) {
    send(res, 400, "Bad request", "text/plain; charset=utf-8");
    return;
  }

  const relativePath = requested === "/" ? "/index.html" : requested;
  const absolutePath = path.normalize(path.join(rootDir, relativePath));
  const relativeToRoot = path.relative(rootDir, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || "application/octet-stream");
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Kalimba ToneTrace server is already running at http://localhost:${port}/index.html`);
    getLanUrls().forEach((url) => console.log(`Phone on same Wi-Fi: ${url}`));
    return;
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`Kalimba ToneTrace server running at http://localhost:${port}/index.html`);
  getLanUrls().forEach((url) => console.log(`Phone on same Wi-Fi: ${url}`));
});
