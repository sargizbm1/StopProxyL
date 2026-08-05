import express from "express";
import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// --- Config pulled from environment ---------------------------------
// MTG_SECRET           -> same secret you gave the mtg-proxy service
// PROXY_DOMAIN          -> reference variable: ${{mtg-proxy.RAILWAY_TCP_PROXY_DOMAIN}}
// PROXY_PORT             -> reference variable: ${{mtg-proxy.RAILWAY_TCP_PROXY_PORT}}
// DASHBOARD_PASSWORD  -> password to view the dashboard (required)
const SECRET = process.env.MTG_SECRET || "";
const DOMAIN =
  process.env.PROXY_DOMAIN || process.env.RAILWAY_TCP_PROXY_DOMAIN || "";
const PROXY_PORT =
  process.env.PROXY_PORT || process.env.RAILWAY_TCP_PROXY_PORT || "";
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

// --- Simple password gate (HTTP Basic Auth) --------------------------
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use((req, res, next) => {
  if (!DASHBOARD_PASSWORD) {
    // Fail closed: refuse to serve anything if no password was configured,
    // since this page displays a secret that grants proxy access.
    return res
      .status(500)
      .send(
        "DASHBOARD_PASSWORD is not set. Set it in the Railway service variables before using this dashboard."
      );
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Proxy Dashboard"');
    return res.status(401).send("Authentication required");
  }

  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  const sepIdx = decoded.indexOf(":");
  const pass = sepIdx >= 0 ? decoded.slice(sepIdx + 1) : "";

  if (!timingSafeEqual(pass, DASHBOARD_PASSWORD)) {
    res.set("WWW-Authenticate", 'Basic realm="Proxy Dashboard"');
    return res.status(401).send("Invalid credentials");
  }

  next();
});

// --- API: proxy connection info --------------------------------------
app.get("/api/proxy", (req, res) => {
  const ready = Boolean(SECRET && DOMAIN && PROXY_PORT);
  res.json({
    ready,
    domain: DOMAIN,
    port: PROXY_PORT,
    secret: SECRET,
    tgLink: ready
      ? `tg://proxy?server=${DOMAIN}&port=${PROXY_PORT}&secret=${SECRET}`
      : null,
    tmeLink: ready
      ? `https://t.me/proxy?server=${DOMAIN}&port=${PROXY_PORT}&secret=${SECRET}`
      : null,
  });
});

// --- Static dashboard page --------------------------------------------
app.get("/", async (req, res) => {
  const html = await readFile(path.join(__dirname, "public", "index.html"));
  res.type("html").send(html);
});

app.listen(PORT, () => {
  console.log(`Dashboard listening on port ${PORT}`);
});
