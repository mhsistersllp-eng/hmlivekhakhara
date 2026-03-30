"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");

if (typeof fetch !== "function") {
  throw new Error("Node 18+ is required because this server uses global fetch.");
}

const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "catalog.json");
const GALLERY_DIRNAME = "catalog-gallery";
const GALLERY_DIR = path.join(REPO_ROOT, GALLERY_DIRNAME);

loadEnvFile(path.join(REPO_ROOT, ".env"));

const PORT = Number(process.env.PORT || 8787);
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const PACKET_SIZE = (process.env.PACKET_SIZE || "200g").trim();
const SYNC_TOKEN = process.env.SYNC_TOKEN || "";
const AUTO_PUSH = String(process.env.GIT_PUSH_ON_SYNC || "false").toLowerCase() === "true";
const COMMIT_MESSAGE = process.env.GIT_COMMIT_MESSAGE || "chore: sync catalog from WhatsApp API";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

function runGit(args) {
  return spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function ensureGitReady() {
  const result = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (result.status !== 0 || !result.stdout.includes("true")) {
    throw new Error("Current directory is not a git repository.");
  }
}

function authOk(urlObj, req) {
  if (!SYNC_TOKEN) return true;
  const tokenFromHeader = String(req.headers["x-sync-token"] || "").trim();
  const tokenFromQuery = String(urlObj.searchParams.get("token") || "").trim();
  return tokenFromHeader === SYNC_TOKEN || tokenFromQuery === SYNC_TOKEN;
}

function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractImageUrl(item) {
  const direct = String(item?.image_url || "").trim();
  if (direct) return direct;
  if (Array.isArray(item?.images)) {
    for (const image of item.images) {
      const maybe = String(image?.url || image?.image_url || "").trim();
      if (maybe) return maybe;
    }
  }
  const nested = String(item?.image?.url || "").trim();
  return nested || "";
}

function guessExtFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "";
}

function guessExtFromUrl(url) {
  const clean = String(url || "").split("?")[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]{3,4})$/);
  if (!match) return "";
  const ext = match[1];
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "";
}

function normalizeProducts(items) {
  const map = new Map();
  for (const item of items) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    if (item?.is_hidden === true) continue;
    const key = name.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      id: String(item?.id || "").trim(),
      name,
      description: String(item?.description || "Freshly roasted with consistent quality.").trim(),
      imageUrl: extractImageUrl(item),
      active: true
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchCatalogProducts(catalogId, accessToken) {
  let url = `${GRAPH_API_BASE}/${catalogId}/products?fields=id,name,description,is_hidden,image_url&limit=100&access_token=${encodeURIComponent(accessToken)}`;
  const all = [];

  while (url) {
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Meta API error (${response.status}): ${text}`);
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Meta API returned non-JSON response.");
    }
    const data = Array.isArray(payload?.data) ? payload.data : [];
    all.push(...data);
    url = payload?.paging?.next || null;
  }

  return all;
}

async function fetchImageBuffer(url, accessToken) {
  let response = await fetch(url);
  if (!response.ok && (response.status === 401 || response.status === 403)) {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status}) for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || ""
  };
}

function writeFileIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  if (previous && Buffer.compare(previous, content) === 0) {
    return false;
  }
  fs.writeFileSync(filePath, content);
  return true;
}

async function downloadCatalogImages(products, accessToken) {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  const keepFiles = new Set();
  let downloaded = 0;

  for (const product of products) {
    if (!product.imageUrl) continue;
    try {
      const { buffer, contentType } = await fetchImageBuffer(product.imageUrl, accessToken);
      const ext = guessExtFromContentType(contentType) || guessExtFromUrl(product.imageUrl) || "jpg";
      const safeBase = sanitizeSlug(product.id || product.name) || `item-${keepFiles.size + 1}`;
      const fileName = `${safeBase}.${ext}`;
      const filePath = path.join(GALLERY_DIR, fileName);
      const changed = writeFileIfChanged(filePath, buffer);
      if (changed) downloaded += 1;
      keepFiles.add(fileName);
      product.galleryImage = `${GALLERY_DIRNAME}/${fileName}`.replace(/\\/g, "/");
    } catch (error) {
      product.galleryImage = "";
      product.imageFetchError = error instanceof Error ? error.message : String(error);
    }
  }

  let removed = 0;
  const existing = fs.readdirSync(GALLERY_DIR, { withFileTypes: true });
  for (const entry of existing) {
    if (!entry.isFile()) continue;
    if (keepFiles.has(entry.name)) continue;
    fs.unlinkSync(path.join(GALLERY_DIR, entry.name));
    removed += 1;
  }

  return { downloaded, removed };
}

function buildCatalogJson(products) {
  return {
    packetSize: PACKET_SIZE || "200g",
    products: products.map((product) => ({
      name: product.name,
      description: product.description,
      ...(product.galleryImage ? { galleryImage: product.galleryImage } : {}),
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      active: true
    }))
  };
}

function writeCatalog(catalog) {
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  const previous = fs.existsSync(CATALOG_PATH) ? fs.readFileSync(CATALOG_PATH, "utf8") : "";
  const changed = serialized !== previous;
  if (changed) {
    fs.writeFileSync(CATALOG_PATH, serialized, "utf8");
  }
  return { changed, bytes: Buffer.byteLength(serialized, "utf8") };
}

function commitCatalog(pushRequested) {
  runGit(["add", "--", "catalog.json", GALLERY_DIRNAME]);
  const stagedDiff = runGit(["diff", "--cached", "--quiet", "--", "catalog.json", GALLERY_DIRNAME]);
  if (stagedDiff.status === 0) {
    return { committed: false, pushed: false, commit: null };
  }
  if (stagedDiff.status !== 1) {
    throw new Error(`Unable to check git diff: ${stagedDiff.stderr || stagedDiff.stdout}`);
  }

  const commitResult = runGit(["commit", "-m", COMMIT_MESSAGE, "--", "catalog.json", GALLERY_DIRNAME]);
  if (commitResult.status !== 0) {
    throw new Error(`Git commit failed: ${commitResult.stderr || commitResult.stdout}`);
  }

  const head = runGit(["rev-parse", "HEAD"]);
  const commitHash = head.status === 0 ? head.stdout.trim() : null;

  const shouldPush = pushRequested || AUTO_PUSH;
  if (shouldPush) {
    const pushResult = runGit(["push", "origin", "main"]);
    if (pushResult.status !== 0) {
      throw new Error(`Git push failed: ${pushResult.stderr || pushResult.stdout}`);
    }
  }

  return { committed: true, pushed: shouldPush, commit: commitHash };
}

async function runSync({ dryRun = false, push = false }) {
  const accessToken = String(process.env.META_ACCESS_TOKEN || "").trim();
  const catalogId = String(process.env.META_CATALOG_ID || "").trim();
  if (!accessToken || !catalogId) {
    throw new Error("Missing META_ACCESS_TOKEN or META_CATALOG_ID environment variables.");
  }

  ensureGitReady();

  const rawProducts = await fetchCatalogProducts(catalogId, accessToken);
  const products = normalizeProducts(rawProducts);
  if (!products.length) {
    throw new Error("No active products returned from Meta catalog.");
  }

  if (dryRun) {
    return {
      mode: "dry-run",
      packetSize: PACKET_SIZE || "200g",
      productCount: products.length,
      withImageUrl: products.filter((p) => p.imageUrl).length,
      sample: products.slice(0, 5)
    };
  }

  const imageResult = await downloadCatalogImages(products, accessToken);
  const catalog = buildCatalogJson(products);
  const writeResult = writeCatalog(catalog);
  const gitResult = commitCatalog(push);
  return {
    mode: "sync",
    packetSize: catalog.packetSize,
    productCount: products.length,
    imageDownloaded: imageResult.downloaded,
    imageRemoved: imageResult.removed,
    fileChanged: writeResult.changed,
    bytesWritten: writeResult.bytes,
    ...gitResult
  };
}

async function handleSync(req, res, urlObj) {
  if (!authOk(urlObj, req)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized. Invalid token." });
    return;
  }

  const dryRun = urlObj.searchParams.get("dryRun") === "1";
  const push = urlObj.searchParams.get("push") === "1";

  try {
    const result = await runSync({ dryRun, push });
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const server = http.createServer(async (req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  const host = req.headers.host || `localhost:${PORT}`;
  const urlObj = new URL(req.url || "/", `http://${host}`);

  if (method === "GET" && urlObj.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "catalog-sync-server" });
    return;
  }

  if ((method === "GET" || method === "POST") && urlObj.pathname === "/sync") {
    await handleSync(req, res, urlObj);
    return;
  }

  if (method === "GET" && urlObj.pathname === "/") {
    sendText(
      res,
      200,
      [
        "HM Live Catalog Sync Server",
        "",
        "Routes:",
        "GET  /health",
        "GET  /sync?dryRun=1",
        "POST /sync",
        "POST /sync?push=1",
        "",
        "Env:",
        "META_ACCESS_TOKEN, META_CATALOG_ID, PACKET_SIZE, PORT, SYNC_TOKEN, GIT_PUSH_ON_SYNC",
        "",
        `Images are downloaded to ./${GALLERY_DIRNAME} and referenced in catalog.json`
      ].join("\n")
    );
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Catalog sync server running on http://localhost:${PORT}`);
});
