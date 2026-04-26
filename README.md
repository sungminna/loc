# loc — 자율 Instagram + Threads 포스팅 시스템

Cloudflare Workers + Sandbox + Claude Code CLI 기반의 자율 콘텐츠 봇.
매분 cron이 due 토픽을 발견 → Cloudflare Queue에 enqueue → Sandbox 컨테이너에서 `claude` 헤드리스 실행 → `.claude/skills/*` 워크플로(리서치 → 기획 → Gemini 이미지 → Remotion 릴스 → IG/Threads 게시)를 자동 수행.

## Architecture

```
Workers Cron (* * * * *)
   ├── scheduler.dispatch() — D1에서 due 토픽 조회 → Queue enqueue
   │
Cloudflare Queues (loc-runs)
   ├── max_concurrency = 3
   └── Consumer:
         ├── Durable Object TopicRunner — 토픽당 동시 1개 락
         └── @cloudflare/sandbox.getSandbox(env.Sandbox, "u-<userId>/run-<runId>")
               ├── exec("git clone … && bun install")
               └── exec("claude -p '...orchestrate-run...'
                          --output-format stream-json
                          --permission-mode bypassPermissions")
                     │
                     └── Skill flow (in-sandbox):
                          topic-research → content-plan → gemini-image (Nano Banana)
                          → select-audio (NCS) → render-reel (Remotion 1080×1920 H.264)
                          → render-threads-image → ig-publish-reel → threads-publish

D1: users · accounts · topics · templates · audio_tracks · runs · posts · metrics · assets · research_notes · oauth_states
R2: 모든 미디어 (커스텀 도메인 → IG/Threads가 fetch)
KV (TOKENS): AES-GCM 암호화된 OAuth 토큰
KV (CACHE): 트렌드/리서치 캐시
DOs: TopicRunner (락) · Sandbox (Containers SDK)
```

## Tech Stack

| 영역 | 선택 |
|---|---|
| 런타임 | Cloudflare Workers + Containers (Sandbox SDK) |
| 언어 | TypeScript (strict, noUncheckedIndexedAccess) |
| Wrangler | v4.x (Containers 정식 지원) |
| Sandbox | `@cloudflare/sandbox@0.4.18` + 베이스 이미지 `docker.io/cloudflare/sandbox:0.4.18` |
| 컨테이너 | EXPOSE 3000 (Sandbox 서버), `instance_type = "standard-1"`, `max_instances = 5` |
| DB | D1 + Drizzle ORM |
| 객체 저장 | R2 (S3 SDK from sandbox) + 커스텀 도메인 공개 URL |
| 큐 | Cloudflare Queues (재시도/DLQ) |
| 동시성 락 | Durable Objects (`TopicRunner`) |
| 인증 | Cloudflare Access (Zero Trust) → `Cf-Access-Authenticated-User-Email` |
| AI | `claude-code` CLI inside sandbox (OAuth) · `gemini-2.5-flash-image` (Nano Banana) via `@google/genai` |
| 비디오 | Remotion 4.x (`@remotion/bundler` + `@remotion/renderer`) |
| 대시보드 | Vite + React 19 + Tailwind 3 + tRPC v11 + superjson |

## Prerequisites

1. Cloudflare 계정 (Workers Paid + Containers 활성)
2. Docker (로컬 dev에서 컨테이너 빌드 시; OrbStack/Colima/Docker Desktop 모두 OK)
3. Bun ≥ 1.1
4. Meta 개발자 앱 (Instagram + Threads 제품 모두 추가)
5. Instagram Business 계정 + 연결된 Facebook Page (Reels 게시는 Business 필수)
6. Threads 계정
7. Google AI Studio API Key (Gemini)
8. Claude Code OAuth 토큰 (`/login` → Settings → OAuth)
9. GitHub 비공개 리포 (sandbox가 매 실행 git clone)

## Setup

```bash
# 0) 의존성
bun install

# 1) 로컬 시크릿 (gitignored .dev.vars)
cat > .dev.vars <<EOF
DEV_USER_EMAIL=you@example.com         # 로컬에서 자동 프로비저닝될 owner 이메일
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
LOC_MASTER_KEY=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)
GEMINI_API_KEY=...
META_APP_ID=...
META_APP_SECRET=...
THREADS_APP_ID=...
THREADS_APP_SECRET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
GITHUB_REPO_URL=https://x-access-token:GH_PAT@github.com/you/loc.git
EOF

# 2) Cloudflare 자원 생성 (출력값을 wrangler.toml의 REPLACE_* 자리에)
wrangler login
wrangler d1 create loc-app
wrangler r2 bucket create loc-media     # → 커스텀 도메인 media.<your-domain> 연결
wrangler kv namespace create TOKENS
wrangler kv namespace create CACHE
wrangler queues create loc-runs
wrangler queues create loc-runs-dlq

# 3) D1 마이그레이션
bun run db:generate
bun run db:migrate:remote                # 또는 --local for miniflare

# 4) 시드 (공유 템플릿 2개 + NCS 트랙 3개)
CLOUDFLARE_ACCOUNT_ID=... D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=... \
  bun scripts/seed.ts

# 5) 배포용 시크릿 (.dev.vars의 같은 키들을 wrangler secret put로 옮기기)
wrangler secret put CLAUDE_CODE_OAUTH_TOKEN
wrangler secret put LOC_MASTER_KEY
# ... (나머지 동일 패턴)

# 6) 대시보드 빌드 + 배포
bun run dashboard:build
bun run deploy
```

## 로컬 개발

```bash
# 컨테이너 빌드 + 워커 부팅 (첫 실행은 cloudflare/sandbox 베이스 다운로드로 ~30s)
bun run dev

# 다른 터미널에서 대시보드 dev 서버 (5173 → 8787 프록시)
bun run dashboard:dev

# 핵심 검증
curl http://localhost:8787/health                # → "ok"
curl http://localhost:8787/api/trpc/me \         # CF Access 헤더 없으면 DEV_USER_EMAIL 사용
  -H "content-type: application/json"
```

## 인증 (10명 사용자, Cloudflare Access)

배포 후:
1. Zero Trust → Access → Applications → Add (Self-hosted)
2. Domain: `<your-worker>.workers.dev` (또는 커스텀 도메인)
3. Path 정책으로 `*` 허용 이메일 10명 등록 (또는 도메인/그룹)
4. **OAuth 콜백만 별도 bypass 정책** 추가 (`/oauth/*/callback`) — Meta가 직접 도달해야 하므로
5. 첫 로그인 시 Worker가 `Cf-Access-Authenticated-User-Email` 헤더로 `users` 테이블에 자동 프로비저닝 (첫 사용자는 `owner`, 이후 `member`)

데이터 격리:
- 토픽/계정/오디오/템플릿/runs/posts 모두 user_id로 격리
- 시스템 시드 템플릿/오디오 (`user_id = NULL`) → 모든 사용자가 사용 가능
- Sandbox 컨테이너 키는 `u-<userId>/run-<runId>` 형태
- Internal API는 sandbox가 보내는 `LOC-Run-Id` 헤더로 자기 run에만 쓰기 가능
- 사용자별 일일 비용 상한 `users.cost_cap_daily_usd` (기본 $20)

## 토큰 부트스트랩 (OAuth 우회)

테스트/개발 시 OAuth dance 없이 long-lived 토큰을 직접 시드:

```bash
CLOUDFLARE_ACCOUNT_ID=... D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=... \
KV_TOKENS_NAMESPACE_ID=... \
FOR_USER_EMAIL=you@example.com \
  bun scripts/bootstrap-accounts.ts
```

`.dev.vars`의 `IG_BOOTSTRAP_TOKEN`, `THREADS_BOOTSTRAP_TOKEN`을 읽어 IG/Threads `accounts` 행을 만들고 토큰을 KV에 AES-GCM 암호화로 저장.

## Skills (`.claude/skills/`)

| Skill | 용도 |
|---|---|
| orchestrate-run | 한 사이클 컨덕터 (research → publish 전체) |
| topic-research | 소스 URL 스크레이핑 + 트렌드 요약 |
| content-plan | brief.json (슬라이드/카피/이미지 프롬프트) 생성 |
| gemini-image | Nano Banana로 9:16 / 4:5 이미지 생성 |
| select-audio | 토픽 mood + 템플릿 mood로 NCS 트랙 1곡 선정 |
| render-reel | Remotion → 1080×1920 H.264 MP4 + ffmpeg +faststart |
| render-threads-image | 1080×1350 단일 프레임 JPG |
| ig-publish-reel | Graph API v23 container/publish (graph.instagram.com) |
| threads-publish | graph.threads.net v1 container/publish |

`.claude/settings.json`은 `defaultMode: "bypassPermissions"` — sandbox 안에서 완전 자율. 단 `rm -rf /`, `mkfs`, `shutdown` 등 catastrophic 명령은 deny.

## 새 템플릿 추가

1. `src/remotion/compositions/<MyTpl>.tsx` 작성
2. `src/remotion/Root.tsx`에 `<Composition id="MyTpl" .../>` 등록
3. 대시보드 → Templates → 새 템플릿 (slug + compositionId="MyTpl")
4. 토픽에서 그 슬러그 선택

Sandbox는 매 실행마다 git clone하므로 커밋 후 즉시 적용됩니다.

## 새 토픽 만들기 (E2E 첫 실행)

1. 대시보드 `/accounts` → "Instagram 연결" / "Threads 연결" (또는 `bootstrap-accounts.ts`)
2. `/audio` → R2에 mp3 업로드 + 메타 등록
3. `/topics` → 새 토픽:
   - 이름, 페르소나, 소스 URL 1-3개
   - 언어, IG/Threads 타겟 계정, 템플릿
   - cron (예: `0 9 * * *`)
4. "지금 실행" → `/posts` 에서 결과 확인 (~3-5분 후)

## Phasing

- ✅ **Phase 1 (현재)**: 단일 사이클 자율 실행 (research → plan → render → publish)
- **Phase 2**: post-analyze 메트릭 자동 수집, 토큰 자동 갱신 cron, 템플릿 라이브 프리뷰, Run 상세 페이지
- **Phase 3**: Suno BGM 생성, Vectorize로 트렌드 임베딩 회고, A/B 템플릿 비교

## 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `containers should be an object, but got an array` | wrangler v3.x. `bun add -d wrangler@^4`로 v4 업그레이드 |
| `instance_type "standard"` 경고 | `standard-1`로 변경 (wrangler 4.85+) |
| `container does not expose any ports` | 우리 Dockerfile이 `cloudflare/sandbox` 베이스를 안 씀. `FROM docker.io/cloudflare/sandbox:0.4.18` 확인 |
| `assets.directory does not exist` | 먼저 `bun run dashboard:build` |
| Sandbox 안에서 `claude: command not found` | Dockerfile에서 `npm install -g @anthropic-ai/claude-code` 했는지 확인 |
| `Cf-Access-Authenticated-User-Email` 없음 | 로컬 dev면 `.dev.vars`에 `DEV_USER_EMAIL=...` 추가 |
| Reel 영상에 한글 안 나옴 | Dockerfile의 `fonts-noto-cjk` 설치 확인 |
