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
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
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

const publicFiles = new Set([
  "index.html", "songs.html", "changelog.html", "support.html",
  "kalimba-practice.html", "manifest.webmanifest", "service-worker.js", "package.json"
]);
const publicDirectories = new Set(["src", "assets"]);

function isPublicPath(relativePath) {
  const segments = relativePath.split(path.sep);
  return !segments.some((segment) => segment.startsWith(".")) &&
    (publicFiles.has(relativePath) || (segments.length > 1 && publicDirectories.has(segments[0])));
}

function serveRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
    return;
  }
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

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot) || !isPublicPath(relativeToRoot)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.realpath(absolutePath, (resolveError, resolvedPath) => {
    if (resolveError) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    // A public directory must not expose private files through a symlink or junction.
    const resolvedRelative = path.relative(rootDir, resolvedPath);
    if (path.isAbsolute(resolvedRelative) || !isPublicPath(resolvedRelative)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    fs.readFile(resolvedPath, (error, data) => {
      if (error) {
        send(res, 404, "Not found", "text/plain; charset=utf-8");
        return;
      }

      const ext = path.extname(absolutePath).toLowerCase();
      send(res, 200, data, mimeTypes[ext] || "application/octet-stream");
    });
  });
}

function createKalimbaServer() {
  return http.createServer(serveRequest);
}

module.exports = { createKalimbaServer };

if (require.main === module) {
  const server = createKalimbaServer();

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
}
