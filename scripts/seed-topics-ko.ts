export {};

// Seed production-ready Korean topics for one user.
//
// Run with:
//   CLOUDFLARE_ACCOUNT_ID=... D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=... \
//     USER_EMAIL=you@cleave.work bun scripts/seed-topics-ko.ts
//
// Or by user id directly:
//   USER_ID=u_abc123 bun scripts/seed-topics-ko.ts
//
// What it does:
//   1. Resolves USER_EMAIL → users.id (or trusts USER_ID).
//   2. INSERT OR IGNORE topics (slug-like name uniqueness via id).
//   3. Each topic has a tuned persona prompt, real KR source URLs, the
//      right shared template assigned, and a sane cron schedule.
//
// You'll still need to:
//   - Connect Instagram/Threads accounts (dashboard → Accounts → Connect).
//   - Fill in `targetAccounts.instagram` / `targetAccounts.threads` per
//     topic via the dashboard once the accounts exist.
//
// Safe to re-run — INSERT OR IGNORE skips topics whose id already exists.

const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const databaseId = required("D1_DATABASE_ID");
const token = required("CLOUDFLARE_API_TOKEN");

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function d1(sql: string, params: unknown[]): Promise<unknown[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const body = (await res.json()) as { success?: boolean; result?: Array<{ results?: unknown[] }>; errors?: unknown };
  if (!res.ok || !body.success) {
    throw new Error(`D1 error: ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  }
  return body.result?.[0]?.results ?? [];
}

const userId = await resolveUserId();
console.log(`▣ Seeding topics for user ${userId}\n`);

interface TopicSeed {
  id: string;
  name: string;
  description: string;
  lang: "ko" | "en" | "ko+en";
  cron: string;
  dailyRunCap: number;
  costCapUsd: number;
  /** Slugs from scripts/seed.ts. The first slug is the primary template. */
  templateSlugs: string[];
  sourceUrls: string[];
  audioMoods: string[];
  personaPrompt: string;
  imageStylePrompt: string;
  hashtagMode: "ai" | "fixed" | "mixed";
  fixedHashtags: string[];
  imageMode: "ai-all" | "ai-first-only" | "template-only";
  threadsFormat: "text" | "image";
}

// All times KST. Cron is interpreted in UTC by the Worker — we offset by
// 9h here so "오전 9시 KST" reads as `0 0 * * *` in UTC.
const TOPICS: TopicSeed[] = [
  {
    id: `tp_ko_ai_daily_${userId.slice(-6)}`,
    name: "AI 데일리 — 한국어",
    description: "매일 아침 글로벌 AI 트렌드를 한국어로 정리. 슈카월드/김덕영 교수 톤.",
    lang: "ko",
    cron: "0 23 * * *",                      // 오전 8시 KST
    dailyRunCap: 1,
    costCapUsd: 4,
    templateSlugs: ["ko-ai-glass", "ko-ai-kinetic", "ko-hot-take", "ko-authority-quote"],
    sourceUrls: [
      "https://www.aitimes.com/news/articleList.html?sc_section_code=S1N1",
      "https://www.aitimes.kr/",
      "https://zdnet.co.kr/news/news_list.asp?contents_id=AI",
      "https://www.mk.co.kr/news/it/",
    ],
    audioMoods: ["chill", "ambient", "cinematic"],
    personaPrompt: [
      "이 계정의 톤: 'AI 업계 인사이더가 출근길 친구한테 한 줄 정리해주는' 느낌. 친근하지만 전문적. 정보 밀도가 높아 보여야 한다. 참고 — 정인성, Andrej Karpathy 의 한국어 오마주.",
      "",
      "이 계정의 약속: '매일 아침 8시, 어제 밤사이 일어난 AI 한 가지를 1분 안에' — 이 promise 가 모든 콘텐츠에 깔려 있어야 한다.",
      "",
      "선호 hook (도메인 매칭, 최소 한 슬라이드는 다음 중 하나로 시작):",
      "  · 'OpenAI/Anthropic/Google 이 어제 ___' (24h 뉴스 urgency)",
      "  · 'Claude 4.7 vs GPT-5, ___ 에서 갈렸다' (직접 비교 + 결과)",
      "  · 'AI 업계 사람들이 진짜 쓰는 ___' (in-group 신호)",
      "  · '이 prompt 한 줄로 ___ 가 ___ 분 → ___ 분' (구체 측정값)",
      "  · '한국 ___ 사 / 모델만 아는 ___' (지역적 specificity)",
      "",
      "캡션·Threads 톤:",
      "  · IG: 1줄 hook + 출처 한 단어 + '오늘처럼 매일 아침 정리합니다 — 팔로우' (recurring promise = 팔로우 전환).",
      "  · Threads: hook 1줄 → 짧은 take 1줄 → 'X파 vs Y파, 어느 쪽 쓰세요?' 같은 구체 질문으로 마감.",
      "",
      "절대 금지:",
      "  · 'AI 모르면 도태됩니다' 같은 fear-mongering (저효율 + 낡음).",
      "  · 'X배 빨라졌다' 라는 측정 없는 과장.",
      "  · 영어 약어 단독 사용 (RAG / MoE 등은 한 번 풀어쓴 후 사용).",
    ].join("\n"),
    imageStylePrompt: "Editorial tech photography, deep navy / cyan palette, soft volumetric lighting, futuristic but minimal, no human faces close-up, no AI-art tropes (no glowing brains, no robot hands), high-end product shot feel.",
    hashtagMode: "mixed",
    fixedHashtags: ["AI", "인공지능", "테크", "AI트렌드", "AI뉴스"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },

  {
    id: `tp_ko_invest_daily_${userId.slice(-6)}`,
    name: "투자 인사이트 — 코스피/미장",
    description: "평일 장 시작 전 한국·미국 시장 핵심 한 가지. 박곰희/슈카월드 톤.",
    lang: "ko",
    cron: "0 0 * * 1-5",                     // 평일 오전 9시 KST
    dailyRunCap: 1,
    costCapUsd: 4,
    templateSlugs: ["ko-finance-data", "ko-finance-minimal", "ko-listicle-top5", "ko-authority-quote"],
    sourceUrls: [
      "https://www.hankyung.com/all-news-stock",
      "https://www.mk.co.kr/news/stock/",
      "https://biz.chosun.com/",
      "https://www.sedaily.com/NewsList/GA01",
    ],
    audioMoods: ["minimal", "ambient", "cinematic"],
    personaPrompt: [
      "이 계정의 톤: 증권사 데일리 리포트를 친구가 슬랙에 한 줄 요약 던져주는 느낌. 차분, 데이터 우선, 정보 밀도 극대화. 참고 — 박곰희(CFA), 슈카월드(이코노미스트 출신), 신과함께 (이진우/김동환/정영진).",
      "",
      "이 계정의 약속: '평일 9시 — 오늘 하루 시장에서 봐야 할 단 한 가지'. 시리즈성 = 팔로우 전환.",
      "",
      "선호 hook (재무 도메인은 사실 기반의 surprise 가 가장 잘 먹힘):",
      "  · '기관이 지난주에 ___ 원 어치 산 종목 한 분야' (institutional flow signal)",
      "  · '신용잔고 ___ 조 돌파, 과거 같은 구간에 무엇이 있었나' (leading-indicator + history)",
      "  · '왜 ___ 가 어제 ___% 빠졌나' (causal explainer, 출처 필수)",
      "  · '워런 버핏 / 레이 달리오가 최근에 정리한 자산' (authority-anchored)",
      "  · '코스피 ___ 깨지면 무엇이 먼저 무너지나' (시나리오, 단정 X 조건문 O)",
      "",
      "슬라이드 5 = 댓글 트리거. 다음 두 가지 중 하나로 마감:",
      "  · '여러분은 지금 어떤 자산 비중이 높으신가요? (현금 / 국내주식 / 미국주식 / 부동산 / 기타)' — 객관식이 답글률 높음",
      "  · '오늘 시장에서 본 가장 의외의 한 줄, 댓글로 공유해주세요'",
      "",
      "캡션·Threads:",
      "  · IG 캡션: hook 1줄 → 핵심 수치 1개 + 출처 → '평일 9시마다 한 줄로 정리합니다 — 팔로우'",
      "  · Threads: 'X 가 ___ 한 진짜 이유는 ___' 형 take 1-2줄 → 'A 시나리오 vs B 시나리오, 어느 쪽 보고 계세요?'",
      "",
      "절대 금지 (법적 + 알고리즘 모두):",
      "  · 종목명 + 매수/매도 결합 ('삼성전자 사세요'). 종목 언급은 OK 단 '관심', '주목', '거래량 증가' 등의 객관 표현만.",
      "  · 가격 목표 ('OOO원 갑니다').",
      "  · 'XX% 확실' 단정 표현. 항상 'XX 가능성', '시나리오' 등 조건부.",
      "  · 면책 한 줄 모든 게시물 마지막: '투자 권유 아님. 본인 판단·책임.'",
    ].join("\n"),
    imageStylePrompt: "Editorial finance photography, Yeouido / Wall Street twilight, deep navy + emerald accent, candlestick chart textures at low opacity, no human faces, sober Bloomberg-magazine aesthetic.",
    hashtagMode: "mixed",
    fixedHashtags: ["투자", "주식", "코스피", "미국주식", "재테크", "경제"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },

  {
    id: `tp_ko_bigtech_${userId.slice(-6)}`,
    name: "글로벌 빅테크 — 한국 관점",
    description: "美 시장 마감 직후 빅테크 한 줄 요약 + 국내 영향. NVDA/AAPL/TSLA/MSFT/META 위주.",
    lang: "ko",
    cron: "30 22 * * 2-6",                   // 화-토 오전 7:30 KST (前날 미국장 마감 후)
    dailyRunCap: 1,
    costCapUsd: 4,
    templateSlugs: ["ko-ai-glass", "ko-finance-data", "ko-before-after"],
    sourceUrls: [
      "https://www.mk.co.kr/news/it/",
      "https://www.hankyung.com/all-news-it",
      "https://www.sedaily.com/NewsList/GH",
      "https://news.einfomax.co.kr/",
    ],
    audioMoods: ["cinematic", "uplifting", "epic"],
    personaPrompt: [
      "이 계정의 톤: 새벽 美장 마감 후 한국 출근길에 던져주는 '오늘 한국 시장에서 무엇이 흔들릴지' 한 장. 빠르고 단단함. 참고 — 슈카월드, 신과함께. 글로벌 → 국내 연결이 핵심 차별점.",
      "",
      "이 계정의 약속: '美장 마감 후 ~12시간 안에, 한국 시장 영향 포인트만 정리'. 화-토 새벽 발행 = '미국장 마감 후 가장 빠른 한국어 정리' 포지셔닝.",
      "",
      "선호 hook (글로벌 → 한국 brigde 가 매번 살아있어야 함):",
      "  · '엔비디아가 어제 ___, SK하이닉스 / 삼성에 의미는 ___' (직접 연결)",
      "  · '테슬라 ___% 변동, 국내 2차전지 3사 어디까지 갔나'",
      "  · '미국 빅테크 시총 ___ 조 변화 = 코스피 ___ 의 ___ 배'",
      "  · 'FOMC 다음 주 ___, 한국 채권시장은 이미 ___ 반영'",
      "  · '한국 시간 새벽 X시 ___ 발표, 우리 시장은 어떻게 열까'",
      "",
      "슬라이드 5 = 다음 catalyst + 시리즈 hook:",
      "  · '다음 주 ___ 발표 — 그날 아침에도 같은 구조로 정리합니다. 팔로우.'",
      "  · 댓글 트리거(주 1회 정도 사용): '여러분이 보고 있는 美 종목 한 개, 댓글에서 공유해주세요'.",
      "",
      "캡션·Threads:",
      "  · IG: hook 1줄 → 핵심 수치 1개 + 출처 (Bloomberg / WSJ / 회사 발표) → '미국장 정리, 매일 새벽 7:30 — 팔로우'",
      "  · Threads: '美 X 사 ___% 변동의 진짜 의미는 ___' → 'A 시나리오 vs B 시나리오, 어느 쪽이 더 가능성 있어 보이세요?'",
      "",
      "절대 금지: 종목 매수/매도 권유, 가격 목표, '확실' 단정. 모든 글 끝 면책: '투자 권유 아님. 본인 판단·책임.'",
    ].join("\n"),
    imageStylePrompt: "Cinematic global tech photography, NYC / Silicon Valley twilight skyline, navy + amber neon accent, minimal subject, editorial magazine feel — not stock-photo cliché.",
    hashtagMode: "mixed",
    fixedHashtags: ["빅테크", "미국주식", "엔비디아", "테슬라", "애플", "투자정보"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },

  {
    id: `tp_ko_ai_dev_${userId.slice(-6)}`,
    name: "AI 코딩 & 개발자 도구",
    description: "Cursor / Claude / Copilot / Codex / Devin 등 AI 코딩 도구 실무 활용 팁.",
    lang: "ko",
    cron: "0 10 */2 * *",                    // 격일 저녁 7시 KST
    dailyRunCap: 1,
    costCapUsd: 5,
    templateSlugs: ["ko-ai-kinetic", "ko-before-after", "ko-hot-take"],
    sourceUrls: [
      "https://news.hada.io/",
      "https://www.aitimes.com/news/articleList.html?sc_section_code=S1N1",
      "https://zdnet.co.kr/news/news_list.asp?contents_id=AI",
    ],
    audioMoods: ["epic", "uplifting", "viral"],
    personaPrompt: [
      "이 계정의 톤: 한국 시니어 개발자가 주니어한테 '이거 모르고 있으면 손해' 라고 짚어주는 느낌. 도구·prompt·워크플로 위주. 측정 가능한 결과로만 말함. 참고 — 노마드코더 (니콜라스), GeekNews (news.hada.io), Karpathy.",
      "",
      "이 계정의 약속: '실무에서 진짜 쓰는 AI 코딩 패턴, 격일 저녁 7시'. 학원·강의 채널 톤 X — '같은 업계 사람이 알려주는 단축키' 톤 O.",
      "",
      "선호 hook (개발자는 'X 했더니 Y' 라는 측정 가능한 결과에만 반응):",
      "  · 'Cursor + Claude Code 1주일 써본 결과: PR 1개 머지까지 ___ 분 → ___ 분' (구체 측정)",
      "  · 'Claude Code 처음 쓸 때 ___ 함, 그래서 ___ 가 망가짐' (실패 경험 = 신뢰)",
      "  · '주니어가 모르고 시니어가 매일 쓰는 ___ 한 가지' (in-group)",
      "  · '이 prompt 한 줄, ___ 작업이 ___ 분 → ___ 분' (시간 압축)",
      "  · 'Claude Code vs Codex vs Devin, ___ 작업에서 갈렸다' (직접 비교)",
      "",
      "슬라이드 5 = save-bait + 시리즈:",
      "  · '저장해두고 다음 PR 때 꺼내 보기 — 🔖' (`emphasis: '🔖'`).",
      "  · 격일 저녁 7시 시리즈임을 가끔 명시: '실무 패턴 격일 발행 — 팔로우'.",
      "  · 댓글 트리거 (주 1회): '여러분 팀에서 가장 자주 쓰는 AI 도구 한 개, 댓글로'.",
      "",
      "캡션·Threads:",
      "  · IG: hook 1줄 → 측정 결과 한 줄 → '실무 패턴 격일 발행 — 팔로우'",
      "  · Threads: 도구 X 단점 / Y 강점을 짧게 → 'X 쓰세요 Y 쓰세요? 이유도 한 줄로'",
      "",
      "절대 금지:",
      "  · 측정 없는 'N배 빨라졌다'.",
      "  · 도구 광고 톤 (특정 회사 PR 처럼 보이면 알고리즘이 suppress).",
      "  · 슬라이드 안에 ≥2줄 코드 (read-time too long).",
      "  · 'AI 모르면 도태' 류 fear.",
    ].join("\n"),
    imageStylePrompt: "Editorial dev-workspace photography, dark IDE-like color palette (deep blue / cyan), soft daylight on a clean desk, no human, minimal — laptop / terminal / mechanical keyboard close-up, shallow depth of field.",
    hashtagMode: "mixed",
    fixedHashtags: ["AI코딩", "개발자", "Cursor", "ClaudeCode", "프로그래밍"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },

  {
    id: `tp_ko_realestate_${userId.slice(-6)}`,
    name: "주간 부동산 & 경제",
    description: "매주 월요일 — 지난 주 부동산·경제 핵심 한 가지. 부읽남 톤.",
    lang: "ko",
    cron: "0 23 * * 0",                      // 월요일 오전 8시 KST
    dailyRunCap: 1,
    costCapUsd: 5,
    templateSlugs: ["ko-finance-data", "ko-finance-minimal", "ko-listicle-top5"],
    sourceUrls: [
      "https://land.hankyung.com/",
      "https://www.mk.co.kr/news/realestate/",
      "https://news.einfomax.co.kr/",
    ],
    audioMoods: ["minimal", "ambient", "chill"],
    personaPrompt: [
      "이 계정의 톤: 정책·통계 기반 차분한 해설. KDI 보고서를 직장인이 출근길에 한 장으로 읽는 느낌. 부동산 = 가격 발화 X, '정책이 바뀌면 무엇이 달라지나' O.",
      "",
      "이 계정의 약속: '월요일 8시 — 지난주 부동산·거시 한 가지를 한 장으로'. 정책 추적 + 데이터 = 신뢰.",
      "",
      "선호 hook (부동산은 손실 회피 + 정책 변화 + 지역 specificity 가 가장 잘 먹힘):",
      "  · '전세 잡기 전에 알아야 할 ___ 한 가지' (pre-decision)",
      "  · '___ 지역 거래량 ___ 배, 무슨 일?' (geographic + 데이터)",
      "  · '대출 규제 ___ 변경, 무엇이 달라지나' (정책 → 실생활)",
      "  · '한국은행 기준금리 ___, 같은 구간 과거에는 ___' (history)",
      "  · '국토부 ___ 발표, 통계로 보는 의미' (공신력 있는 출처)",
      "",
      "슬라이드 5 = save-bait OR 댓글 트리거:",
      "  · '계약 / 분양 앞두고 다시 보기 — 🔖'",
      "  · 'XX 지역 거주 / 관심 있는 분, 댓글에 지역 한 단어'",
      "",
      "캡션·Threads:",
      "  · IG: hook 1줄 → 핵심 수치 + 출처 (KB부동산 / 한국부동산원 / 국토부) → '월요일마다 한 장으로 — 팔로우'",
      "  · Threads: 정책 변화의 의미 1-2줄 → '여러분 동네는 어떻게 보고 계세요?'",
      "",
      "절대 금지: 가격 전망 단정 ('OOO 갑니다'), '지금이 매수 타이밍', 특정 단지/지역 추천. 면책 한 줄 필수.",
    ].join("\n"),
    imageStylePrompt: "Editorial real-estate photography, soft warm daylight, Seoul / 한강 / 강남 skyline at dawn or dusk, no human in frame, calm magazine aesthetic, neutral steel palette with amber accent.",
    hashtagMode: "mixed",
    fixedHashtags: ["부동산", "경제", "재테크", "금리", "주간경제"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },

  {
    id: `tp_ko_trend_weekly_${userId.slice(-6)}`,
    name: "주간 트렌드 — MZ 핫이슈",
    description: "매주 금요일 저녁. 한 주 동안의 검색 / SNS / 문화 핫이슈 5개.",
    lang: "ko",
    cron: "0 9 * * 5",                       // 금요일 오후 6시 KST
    dailyRunCap: 1,
    costCapUsd: 4,
    templateSlugs: ["ko-listicle-top5", "ko-trend-card", "ko-hot-take"],
    sourceUrls: [
      "https://datalab.naver.com/",
      "https://news.naver.com/main/ranking/popularDay.naver",
      "https://www.mk.co.kr/news/culture/",
    ],
    audioMoods: ["uplifting", "viral", "epic"],
    personaPrompt: [
      "이 계정의 톤: 매거진B / 매경 컬처 섹션의 데이터 기반 트렌드 디테일. '왜 갑자기 ___' 의 진짜 이유를 한 장에 풀어주는 느낌. 자극 X, 정보 밀도 O.",
      "",
      "이 계정의 약속: '매주 금요일 6시 — 한 주의 검색 / SNS / 소비 데이터 5개'. 5-card listicle = 저장 + 공유에 최적화.",
      "",
      "선호 hook (트렌드는 'belonging' + 'discovery' 두 축이 살아있어야 함):",
      "  · '이번 주 검색량 ___ 배 늘어난 ___' (data + trend)",
      "  · 'Z세대가 갑자기 ___ 안 쓰는 이유' (generational shift)",
      "  · '한 주 동안 가장 많이 ___ 한 동네 5곳' (geographic listicle)",
      "  · '왜 ___ 가 다시 유행하는가, 진짜 이유' (revival narrative)",
      "  · '요즘 ___ 사람들이 공통으로 ___ 하는 것' (in-group pattern)",
      "",
      "슬라이드 구조 (5개 카드 listicle 권장):",
      "  · 슬라이드 1 — 이번 주 핵심 한 줄 (다섯 가지 중 가장 surprise 한 것).",
      "  · 슬라이드 2-5 — 핫이슈 1개씩, 각 슬라이드는 'XX (네이버 데이터랩 - YY%)' 형식의 출처 박힌 한 장.",
      "  · 마지막 슬라이드 = 공유/저장 트리거: '친구한테 보내고 싶은 항목 ___?' 또는 '🔖 다음 주 트렌드 받기'.",
      "",
      "캡션·Threads:",
      "  · IG: hook 1줄 (5개 중 가장 강한 것) → 출처 (네이버 데이터랩 / 구글 트렌드) → '매주 금요일 6시 — 팔로우'",
      "  · Threads: 1-2개 트렌드 take + '여러분이 이번 주 가장 많이 본 / 얘기한 것은?' 식 댓글 트리거",
      "",
      "절대 금지:",
      "  · 정치적 / 종교적 / 젠더 논쟁 이슈 (계정 페널티 + 댓글 토위로 알고리즘 suppress).",
      "  · 출처 없는 'X 가 화제' 류 추측.",
      "  · '충격', '미친', '헉', '대박' 류 — 2026 알고리즘은 이런 단어가 들어가면 저효율로 분류.",
      "  · 인물 비방 / 가십.",
    ].join("\n"),
    imageStylePrompt: "Modern Korean Instagram card-news photography, soft pastel pop-art palette, single editorial subject (object representing the trend), clean studio lighting, no human face close-up, leaves room for a 9:16 frosted glass card overlay.",
    hashtagMode: "mixed",
    fixedHashtags: ["트렌드", "MZ", "주간이슈", "한국트렌드", "인스타카드뉴스"],
    imageMode: "ai-all",
    threadsFormat: "image",
  },
];

// ─── Insert ────────────────────────────────────────────────────────────

let ok = 0, fail = 0;
for (const t of TOPICS) {
  try {
    await d1(
      `INSERT OR IGNORE INTO topics
        (id, user_id, name, description, lang, persona_prompt, source_urls,
         target_accounts, template_slugs, audio_prefs, cron, daily_run_cap,
         cost_cap_usd, enabled, image_style_prompt, image_mode, threads_format,
         hashtag_mode, fixed_hashtags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        userId,
        t.name,
        t.description,
        t.lang,
        t.personaPrompt,
        JSON.stringify(t.sourceUrls),
        JSON.stringify(t.templateSlugs),
        JSON.stringify({ moodTags: t.audioMoods, allowedSources: ["ncs", "upload"] }),
        t.cron,
        t.dailyRunCap,
        t.costCapUsd,
        t.imageStylePrompt,
        t.imageMode,
        t.threadsFormat,
        t.hashtagMode,
        JSON.stringify(t.fixedHashtags),
        Date.now(),
        Date.now(),
      ],
    );
    ok++;
    console.log(`  ✓ ${t.name}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${t.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed.`);
console.log("\n다음 단계:");
console.log("  1. 대시보드에서 Instagram / Threads 계정 연결.");
console.log("  2. 각 토픽 편집 → Target Accounts 선택 → Enabled ON.");
console.log("  3. (선택) 한국어 NCS BGM 트랙 추가 — Audio Library 에서.");
process.exit(fail > 0 ? 1 : 0);

// ─── Helpers ───────────────────────────────────────────────────────────

async function resolveUserId(): Promise<string> {
  const direct = process.env.USER_ID;
  if (direct) return direct;

  const email = process.env.USER_EMAIL;
  if (!email) {
    console.error("Either USER_ID or USER_EMAIL must be set.");
    console.error("  USER_EMAIL=you@example.com bun scripts/seed-topics-ko.ts");
    process.exit(1);
  }

  const rows = await d1("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) {
    console.error(`No user found with email ${email}.`);
    console.error("Sign in to the dashboard once first to provision the user row.");
    process.exit(1);
  }
  return row.id;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} env var is required`);
    process.exit(1);
  }
  return v;
}
