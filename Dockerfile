# Cloudflare Sandbox base image — ships the sandbox server on port 3000.
# Pin tag to match the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.9.0

ENV DEBIAN_FRONTEND=noninteractive

# Extra tools our orchestrate-run workflow needs on top of the base image:
#  - ffmpeg: post-process Remotion mp4 (+faststart)
#  - chromium libs: Remotion headless rendering
#  - Noto CJK fonts + emoji: render Korean + emoji slides correctly
#  - @anthropic-ai/claude-code: the headless `claude -p` runner
#
# bun, node, npm, curl, git are ALREADY present in cloudflare/sandbox:0.9.0
# (see upstream Dockerfile — bun copied from oven/bun, node + npm copied from
# node:20-slim). We previously re-installed bun via `bun.sh/install`; that
# was redundant work plus a network dependency at build time. Instead we
# assert the binary exists via `bun --version` so a future base-image
# regression fails the build loudly here, not silently at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpangocairo-1.0-0 \
      libpango-1.0-0 libasound2 libatspi2.0-0 \
      fonts-noto-cjk fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/* \
  && bun --version \
  && node --version \
  && npm install -g @anthropic-ai/claude-code \
  && claude --version

# Pre-bake Remotion's bundled Chromium into the image so per-run sandbox
# containers don't have to download ~150 MB from inside the (sometimes
# unreliable) sandbox network on every run. The previous attempt put the
# install in /tmp and `rm`'d it after the download — which deleted the
# Chromium cache too, since @remotion/renderer downloads via puppeteer-
# browsers into PUPPETEER_CACHE_DIR (default: $HOME/.cache/puppeteer/).
# Pin that env var to a stable path AND keep the install on disk; the
# spawner sets the same PUPPETEER_CACHE_DIR at runtime so Remotion finds
# the prefetched binary instantly.
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer-cache
RUN mkdir -p /opt/remotion-runtime \
  && cd /opt/remotion-runtime \
  && npm init -y >/dev/null \
  && npm install --no-save @remotion/renderer@4 \
  && node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('remotion chromium prefetched')).catch(e => { console.error('ensureBrowser failed:', e); process.exit(1); })" \
  && echo "[chromium cache layout]" && ls -la /opt/puppeteer-cache 2>&1 | head -5 \
  && find /opt/puppeteer-cache -name 'headless_shell' -o -name 'chrome' 2>/dev/null | head -3 \
  && find / -name 'headless_shell' -not -path '/proc/*' 2>/dev/null | head -3

# The base image already declares the workdir, server CMD, and EXPOSE 3000.
# Do NOT override CMD — the sandbox server must remain the entrypoint.
