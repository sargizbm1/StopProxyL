FROM p3terx/mtg:latest

# mtg listens on 3128 inside the container by default.
# Railway's TCP Proxy feature maps a public domain:port to this internal port.
EXPOSE 3128

# SECRET must be set as an environment variable on the Railway service
# (see README for how to generate it). We fail fast with a clear error
# if it's missing instead of silently generating a throwaway one, because
# the dashboard needs the exact same secret to build a working link.
ENTRYPOINT ["sh", "-c", "if [ -z \"$SECRET\" ]; then echo 'ERROR: SECRET env var is not set. See README.md.' >&2; exit 1; fi; exec mtg run \"$SECRET\" --bind 0.0.0.0:3128"]
