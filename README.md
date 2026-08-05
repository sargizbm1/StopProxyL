# Telegram MTProto Proxy on Railway (fully automated)

One service, one Dockerfile. On first boot the app:

1. Downloads and runs `mtg` (the MTProto proxy) as a child process.
2. **Generates its own secret** the first time it starts — nothing to run locally, nothing to paste in.
3. **Generates its own dashboard password** and prints it once to the Railway deploy logs (unless you set your own).
4. Serves a password-protected dashboard that reads Railway's own `RAILWAY_TCP_PROXY_DOMAIN` / `RAILWAY_TCP_PROXY_PORT` variables (auto-injected, no reference variables to wire up) and shows the ready-to-use `tg://proxy?...` link + QR code.

## Deploy

1. Push this folder to a GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**, pick it. Railway builds the Dockerfile automatically.
3. In the service's **Networking** tab:
   - Enable **TCP Proxy**, targeting internal port `3128`. Railway assigns a public domain:port for the proxy.
   - Enable a public **HTTP domain** so you can reach the dashboard in a browser.
4. (Recommended) Add a **Volume** mounted at `/data`. This is what makes the secret and dashboard password survive redeploys instead of regenerating each time.
5. Deploy. Open the **Deploy Logs** once and copy the dashboard password that gets printed — it looks like:
   ```
   ============================================================
    TELEGRAM PROXY READY
    Dashboard user: admin
    Dashboard pass: aB3xQ9k...
   ============================================================
   ```

## Use it

Open the dashboard's public URL, log in with username `admin` and the password from the logs. You'll see the server, port, secret, `tg://` link (tap to open Telegram directly), and a QR code to scan.

## Optional environment variables

None of these are required — the app works with zero configuration beyond enabling TCP Proxy — but you can override:

| Variable | Default | Purpose |
|---|---|---|
| `DASHBOARD_PASSWORD` | auto-generated | Set your own instead of using the generated one |
| `FRONTING_DOMAIN` | `www.google.com` | Domain the FakeTLS secret disguises traffic as |
| `MTG_PORT` | `3128` | Internal port mtg listens on — must match what you set in TCP Proxy |
| `DATA_DIR` | `/data` | Where the secret/password are persisted (point this at your Volume's mount path if different) |

## Notes

- **Without a Volume:** the app still works, it just generates a fresh secret and password on every redeploy (not on ordinary restarts/crashes — only full redeploys). Mount a Volume at `/data` if you want stable, long-lived credentials.
- **Rotating the secret:** delete `secret.txt` from the volume (or just remove the volume and redeploy) to force a new one.
- **Registering with @MTProxybot:** optional, not required for personal use.
- The dashboard is Basic Auth-protected because it displays a secret that grants proxy access — don't share the dashboard URL/password with anyone you don't want using your proxy.
