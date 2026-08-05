import express from "express";
import crypto from "crypto";
import { spawn, execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config -----------------------------------------------------------
// DATA_DIR should point at a mounted Railway Volume so the generated
// secret/password survive redeploys. Falls back to a local folder
// (still fine — it just means a redeploy generates fresh credentials).
const DATA_DIR = process.env.DATA_DIR || "/data";
const FALLBACK_DIR = path.join(__dirname, ".state");
const STATE_DIR = existsSync(DATA_DIR) || tryMkdir(DATA_DIR) ? DATA_DIR : FALLBACK_DIR;
if (STATE_DIR === FALLBACK_DIR) mkdirSync(FALLBACK_DIR, { recursive: true });

const SECRET_FILE = path.join(STATE_DIR, "secret.txt");
const PASSWORD_FILE = path.join(STATE_DIR, "dashboard-password.txt");

const MTG_PORT = process.env.MTG_PORT || "3128";
const HTTP_PORT = process.env.PORT || 8080;
const FRONTING_DOMAIN = process.env.FRONTING_DOMAIN || "www.google.com";

function tryMkdir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// --- Step 1: get or generate the proxy secret --------------------------
function ensureSecret() {
  if (existsSync(SECRET_FILE)) {
    const existing = readFileSync(SECRET_FILE, "utf8").trim();
    if (existing) return existing;
  }
  console.log(`[setup] Generating a new FakeTLS secret (fronting: ${FRONTING_DOMAIN})...`);
  const generated = execFileSync("mtg", ["generate-secret", "tls", "-c", FRONTING_DOMAIN])
    .toString()
    .trim();
  writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

// --- Step 2: get or generate the dashboard password ---------------------
function ensureDashboardPassword() {
  if (process.env.DASHBOARD_PASSWORD) return process.env.DASHBOARD_PASSWORD;
  if (existsSync(PASSWORD_FILE)) {
    const existing = readFileSync(PASSWORD_FILE, "utf8").trim();
    if (existing) return existing;
  }
  const generated = crypto.randomBytes(9).toString("base64url");
  writeFileSync(PASSWORD_FILE, generated, { mode: 0o600 });
  return generated;
}

const SECRET = ensureSecret();
const DASHBOARD_PASSWORD = ensureDashboardPassword();

console.log("=".repeat(60));
console.log(" TELEGRAM PROXY READY");
console.log(` Dashboard user: admin`);
console.log(` Dashboard pass: ${DASHBOARD_PASSWORD}`);
console.log(` (persisted at ${PASSWORD_FILE}${STATE_DIR === FALLBACK_DIR ? " — mount a Volume at /data to keep this across redeploys" : ""})`);
console.log("=".repeat(60));

// --- Step 3: run mtg as a child process, restart it if it dies ----------
function startMtg() {
  const child = spawn("mtg", ["run", SECRET, "--bind", `0.0.0.0:${MTG_PORT}`], {
    stdio: "inherit",
  });
  let restarted = false;
  const restart = (reason) => {
    if (restarted) return;
    restarted = true;
    console.error(`[mtg] ${reason}, restarting in 3s...`);
    setTimeout(startMtg, 3000);
  };
  child.on("error", (err) => restart(`failed to start (${err.message})`));
  child.on("exit", (code) => restart(`exited with code ${code}`));
}
startMtg();

// --- Step 4: dashboard web server ---------------------------------------
const app = express();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Proxy Dashboard"');
    return res.status(401).send("Authentication required");
  }
  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  const pass = decoded.slice(decoded.indexOf(":") + 1);
  if (!timingSafeEqual(pass, DASHBOARD_PASSWORD)) {
    res.set("WWW-Authenticate", 'Basic realm="Proxy Dashboard"');
    return res.status(401).send("Invalid credentials");
  }
  next();
});

app.get("/api/proxy", (req, res) => {
  // These are auto-injected by Railway on this same service once
  // TCP Proxy networking is enabled for MTG_PORT — no manual copying needed.
  const domain = process.env.RAILWAY_TCP_PROXY_DOMAIN || "";
  const port = process.env.RAILWAY_TCP_PROXY_PORT || "";
  const ready = Boolean(domain && port && SECRET);
  res.json({
    ready,
    domain,
    port,
    secret: SECRET,
    tgLink: ready ? `tg://proxy?server=${domain}&port=${port}&secret=${SECRET}` : null,
    tmeLink: ready
      ? `https://t.me/proxy?server=${domain}&port=${port}&secret=${SECRET}`
      : null,
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(HTTP_PORT, () => {
  console.log(`[dashboard] listening on port ${HTTP_PORT}`);
});
