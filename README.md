# Telegram MTProto Proxy on Railway

Two services in one Railway project:

- **`mtg-proxy`** — runs [mtg](https://github.com/9seconds/mtg), listens on port 3128, exposed publicly via Railway's **TCP Proxy**.
- **`dashboard`** — password-protected web page that shows the secret, the `tg://proxy?...` link, and a QR code, built from the mtg service's live TCP domain/port.

## 1. Generate a secret (one time)

You need Docker installed locally for this one step (or use any machine with Docker):

```bash
docker run --rm p3terx/mtg generate-secret tls -c www.google.com
```

This prints something like:

```
ee7a1c9e2f...676f6f676c652e636f6d
```

That's your `SECRET` — a "FakeTLS" secret that disguises the proxy traffic as a normal HTTPS connection to `www.google.com`. Copy it, you'll paste it into Railway in a moment. You can swap `www.google.com` for any other real HTTPS domain if you want.

## 2. Create the Railway project

1. Push this folder to a GitHub repo (or use the Railway CLI to deploy from local).
2. In Railway, **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway will find two subfolders. Create two services, each pointed at its own root directory:
   - Service **`mtg-proxy`** → root directory `mtg-proxy/`
   - Service **`dashboard`** → root directory `dashboard/`

## 3. Configure `mtg-proxy`

- **Variables:**
  - `SECRET` = the value you generated in step 1
- **Networking → TCP Proxy:** enable it, targeting internal port `3128`. Railway will assign a public domain and port, exposed on this service as the auto-injected variables `RAILWAY_TCP_PROXY_DOMAIN` and `RAILWAY_TCP_PROXY_PORT`.
- Deploy. Check the logs — it should show `mtg` starting and listening.

## 4. Configure `dashboard`

- **Variables:**
  - `MTG_SECRET` = the **same** secret from step 1
  - `PROXY_DOMAIN` = reference variable: `${{mtg-proxy.RAILWAY_TCP_PROXY_DOMAIN}}`
  - `PROXY_PORT` = reference variable: `${{mtg-proxy.RAILWAY_TCP_PROXY_PORT}}`
  - `DASHBOARD_PASSWORD` = a password of your choice (**required** — the dashboard refuses to render without it, since it displays your proxy secret)
- **Networking:** enable a public **HTTP domain** (the standard Railway domain, not TCP proxy) so you can open the dashboard in a browser.
- Deploy.

> Reference variables (`${{service.VARIABLE}}`) are Railway's built-in way to pull one service's variables into another within the same project — set them in the Variables tab of the `dashboard` service, referencing the `mtg-proxy` service by its Railway service name.

## 5. Use it

Open the dashboard's public URL, log in with the username `admin` and the `DASHBOARD_PASSWORD` you set (browser Basic Auth prompt), and you'll see:

- Server / port / secret, each with a copy button
- The full `tg://proxy?...` link (tap to open directly in Telegram on mobile)
- A QR code — scan it in the Telegram app to auto-configure the proxy

## Notes

- **Rotating the secret:** generate a new one (step 1), update `SECRET` on `mtg-proxy` and `MTG_SECRET` on `dashboard`, redeploy both. Old clients using the old secret will stop working immediately.
- **Multiple proxies:** duplicate the `mtg-proxy` service (different `SECRET`, its own TCP proxy) and point additional dashboard instances at each, if you want several independent proxy endpoints.
- **Registering with @MTProxybot:** optional. Telegram lets you register a proxy with [@MTProxybot](https://t.me/MTProxybot) to get promoted-channel features; not required for it to work for you personally.
- The dashboard is gated with HTTP Basic Auth because it displays a secret that grants proxy access — don't skip setting `DASHBOARD_PASSWORD`, and don't share the dashboard URL/password with anyone you don't want using your proxy.
