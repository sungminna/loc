# Cloudflare Sandbox base image — ships the sandbox server on port 3000.
# Pin tag to match the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.9.0

ENV DEBIAN_FRONTEND=noninteractive

# Extra tools our orchestrate-run workflow needs:
#  - ffmpeg: post-process Remotion mp4 (+faststart)
#  - chromium libs: Remotion headless rendering
#  - Noto CJK fonts + emoji: render Korean + emoji slides correctly
#  - bun: run our TS scripts directly inside the sandbox
#  - @anthropic-ai/claude-code: the headless `claude -p` runner
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpangocairo-1.0-0 \
      libpango-1.0-0 libasound2 libatspi2.0-0 \
      fonts-noto-cjk fonts-noto-color-emoji \
      curl unzip git \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
  && npm install -g @anthropic-ai/claude-code

# Pre-bake Remotion's bundled Chromium into /root/.cache/remotion/. Without
# this, the first selectComposition/renderMedia call in each run triggers a
# ~150 MB Chromium auto-download from inside the per-run sandbox container.
# That download has been observed to fail silently in the sandbox network,
# leaving render-reel.ts to throw with a stack like `at
# processTicksAndRejections (native:7:39)` and no actionable message —
# which is exactly the failure pattern we hit. By prefetching at image-
# build time the cache lives in the image layer and is available from the
# moment a fresh container boots, every run.
RUN mkdir -p /tmp/remotion-prefetch \
  && cd /tmp/remotion-prefetch \
  && npm init -y >/dev/null \
  && npm install --no-save @remotion/renderer@4 \
  && node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('remotion chromium prefetched')).catch(e => { console.error('ensureBrowser failed:', e); process.exit(1); })" \
  && echo "[chromium cache layout]" \
  && find /root -type d -name "*remotion*" -o -name "*chrome*" -o -name "*chromium*" -o -name "*puppeteer*" 2>/dev/null | head -20 \
  && cd / && rm -rf /tmp/remotion-prefetch

# The base image already declares the workdir, server CMD, and EXPOSE 3000.
# Do NOT override CMD — the sandbox server must remain the entrypoint.
