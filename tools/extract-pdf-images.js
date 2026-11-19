/* Dump embedded image XObjects from a PDF so we can reuse the CV portrait.
   Usage: node tools/extract-pdf-images.js <file.pdf> <outdir> */

const fs = require("fs");
const path = require("path");

const [pdfPath, outDir] = process.argv.slice(2);
if (!pdfPath || !outDir) {
  console.error("usage: node extract-pdf-images.js <file.pdf> <outdir>");
  process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const text = buf.toString("latin1");
const out = path.resolve(outDir);
fs.mkdirSync(out, { recursive: true });

const objRe = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
let match;
let count = 0;
const found = [];

while ((match = objRe.exec(text))) {
  const num = match[1];
  const body = match[2];
  if (!/\/Subtype\s*\/Image/.test(body)) continue;

  const dict = body.slice(0, body.indexOf("stream"));
  const width = (dict.match(/\/Width\s+(\d+)/) || [])[1];
  const height = (dict.match(/\/Height\s+(\d+)/) || [])[1];
  const filter = (dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/) || [])[1] || "";
  const bpc = (dict.match(/\/BitsPerComponent\s+(\d+)/) || [])[1] || "";

  const streamIdx = body.indexOf("stream");
  if (streamIdx < 0) continue;
  let start = streamIdx + "stream".length;
  if (body[start] === "\r") start++;
  if (body[start] === "\n") start++;
  const end = body.lastIndexOf("endstream");
  if (end < 0 || end <= start) continue;

  const bytes = Buffer.from(body.slice(start, end), "latin1");
  const info = { num, width, height, filter: filter.replace(/\s+/g, " "), bpc, bytes: bytes.length };
  found.push(info);

  if (/DCTDecode/i.test(filter)) {
    const file = path.join(out, `img-${num}-${width}x${height}.jpg`);
    fs.writeFileSync(file, bytes);
    info.file = file;
    count++;
  } else if (/JPXDecode/i.test(filter)) {
    const file = path.join(out, `img-${num}-${width}x${height}.jp2`);
    fs.writeFileSync(file, bytes);
    info.file = file;
    count++;
  }
}

console.log(
  found
    .map((f) => `${f.num}: ${f.width}x${f.height} ${f.filter} bpc=${f.bpc} ${(f.bytes / 1024).toFixed(1)}KB ${f.file || "(not dumped)"}`)
    .join("\n")
);
console.log(`\nwrote ${count} image file(s) to ${out}`);
