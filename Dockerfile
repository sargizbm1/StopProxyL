FROM node:20-alpine

# --- Fetch the mtg binary (prebuilt release, no external Docker image needed) ---
ARG MTG_VERSION=2.2.8
RUN apk add --no-cache curl tar ca-certificates \
  && curl -fsSL -o /tmp/mtg.tar.gz \
       "https://github.com/9seconds/mtg/releases/download/v${MTG_VERSION}/mtg-${MTG_VERSION}-linux-amd64.tar.gz" \
  && tar -xzf /tmp/mtg.tar.gz -C /tmp \
  && BIN="$(find /tmp -type f -name 'mtg')" \
  && mv "$BIN" /usr/local/bin/mtg \
  && chmod +x /usr/local/bin/mtg \
  && rm -rf /tmp/mtg.tar.gz /tmp/mtg-*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production
# 8080 (overridden by Railway's $PORT) = dashboard HTTP
# 3128 = mtg proxy, exposed publicly via Railway's TCP Proxy feature
EXPOSE 8080 3128

CMD ["node", "index.js"]
