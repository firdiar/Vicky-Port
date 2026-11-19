/* Minimal static file server for the portfolio.
   Zero dependencies: serves the folder, prints a network URL, answers HEAD and
   supports byte ranges so the CV PDF streams.

   Usage:  node tools/serve.js [port]
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function resolvePath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch (e) {
    return null;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const resolved = path.resolve(ROOT, "." + pathname);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function notFound(res) {
  const body = Buffer.from("404 — not found");
  send(res, 404, { "Content-Type": "text/plain; charset=utf-8", "Content-Length": body.length }, body);
}

function serveFile(req, res, file) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);

    const type = mimeFor(file);
    const headers = {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": type.startsWith("text/html") ? "no-cache" : "no-cache, must-revalidate",
      "Accept-Ranges": "bytes",
    };

    const range = req.headers.range;
    let status = 200;
    let start = 0;
    let end = stat.size - 1;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        if (m[1] !== "") start = Number(m[1]);
        if (m[2] !== "") end = Number(m[2]);
        if (m[1] === "") {
          start = Math.max(0, stat.size - Number(m[2]));
          end = stat.size - 1;
        }
        if (start > end || start >= stat.size) {
          return send(res, 416, { "Content-Range": "bytes */" + stat.size }, "");
        }
        status = 206;
        headers["Content-Range"] = "bytes " + start + "-" + end + "/" + stat.size;
      }
    }

    headers["Content-Length"] = end - start + 1;

    if (req.method === "HEAD") {
      return send(res, status, headers, "");
    }

    const stream = fs.createReadStream(file, { start, end });
    res.writeHead(status, headers);
    stream.pipe(res);
    stream.on("error", () => res.destroy());
  });
}

const server = http.createServer((req, res) => {
  const started = Date.now();

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { Allow: "GET, HEAD", "Content-Type": "text/plain" }, "Method not allowed");
  }

  const file = resolvePath(req.url);
  if (!file) return notFound(res);

  res.on("finish", () => {
    console.log(
      `${new Date().toISOString()}  ${req.method} ${req.url}  ${res.statusCode}  ${Date.now() - started}ms`
    );
  });

  serveFile(req, res, file);
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) {
        out.push({ name, address: net.address });
      }
    }
  }
  return out;
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: powershell -File tools\\serve.ps1 -Port 8081`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  kitmd / Ficky Apriando - static site");
  console.log("  root: " + ROOT);
  console.log("");
  console.log("  local:    http://localhost:" + PORT + "/");
  const lans = lanAddresses();
  for (const l of lans) {
    console.log(`  network:  http://${l.address}:${PORT}/   (${l.name})`);
  }
  if (!lans.length) console.log("  network:  no LAN IPv4 address found");
  console.log("");
  console.log("  Ctrl+C to stop.");
  console.log("");
});
