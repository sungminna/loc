# Cloudflare Sandbox base image — ships the sandbox server on port 3000.
# Pin tag to match the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.4.18

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

# The base image already declares the workdir, server CMD, and EXPOSE 3000.
# Do NOT override CMD — the sandbox server must remain the entrypoint.
