export {};

// Seed shared (system) templates and a few NCS audio rows. Idempotent.
//
// Run with:
//   CLOUDFLARE_ACCOUNT_ID=... D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=... \
//     bun scripts/seed.ts
//
// Templates and NCS audio are seeded with user_id = NULL → visible to every
// tenant. NCS mp3s themselves must already exist in R2 at the listed
// audio/ncs/<slug>.mp3 keys.

const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const databaseId = required("D1_DATABASE_ID");
const token = required("CLOUDFLARE_API_TOKEN");

const now = Date.now();

const STATEMENTS: { sql: string; params: unknown[] }[] = [
  // ── shared templates ─────────────────────────────────────────────
  {
    sql: `INSERT OR IGNORE INTO templates
      (id, user_id, slug, name, kind, composition_id, schema, defaults, default_audio_mood, duration_sec, version, enabled, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, '{}', '{}', ?, ?, 1, 1, ?, ?)`,
    params: ["tpl_card_news_default", "card-news-default", "Card News (default)", "reel-cards", "CardNews", '["uplifting","minimal"]', 18, now, now],
  },
  {
    sql: `INSERT OR IGNORE INTO templates
      (id, user_id, slug, name, kind, composition_id, schema, defaults, default_audio_mood, duration_sec, version, enabled, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, '{}', '{}', '[]', 0, 1, 1, ?, ?)`,
    params: ["tpl_threads_card_default", "threads-card-default", "Threads Card (default)", "threads-photo", "ThreadsCard", now, now],
  },

  // ── new card-news templates (8 styles) ───────────────────────────
  templateInsert(
    "tpl_kinetic_type", "kinetic-type", "Kinetic Type",
    "reel-animated", "KineticType", 19, "#ffe45c",
    '["uplifting","epic","viral"]',
    "Cinematic editorial backdrop, ultra-high contrast monochrome with a single vivid accent, minimal subject, soft volumetric light, 50mm lens, shallow depth of field. Leave large empty negative space for typography.",
  ),
  templateInsert(
    "tpl_bold_editorial", "bold-editorial", "Bold Editorial",
    "reel-cards", "BoldEditorial", 21, "#e63946",
    '["chill","minimal","cinematic"]',
    "Editorial magazine still life, warm natural light, paper-textured backdrop, single hero subject offset to the right two-thirds, muted earthy palette with a single saturated accent.",
  ),
  templateInsert(
    "tpl_minimal_grid", "minimal-grid", "Minimal Grid",
    "reel-cards", "MinimalGrid", 18, "#ffe45c",
    '["minimal","ambient","vlog"]',
    "Architectural minimalism, swiss-grid composition, monochrome black/white photography with soft daylight, single subject in lower-right third, generous negative space.",
  ),
  templateInsert(
    "tpl_neo_brutalism", "neo-brutalism", "Neo Brutalism",
    "reel-cards", "NeoBrutalism", 20, "#ff2d55",
    '["uplifting","viral","epic"]',
    "Bold pop graphic backdrop, flat saturated risograph color, hard shadows, halftone texture, photographic subject cut out and laid over a thick-bordered colored field.",
  ),
  templateInsert(
    "tpl_glass_morph", "glass-morphism", "Glass Morphism",
    "reel-cards", "GlassMorphism", 20, "#a78bfa",
    '["chill","ambient","minimal"]',
    "Dreamy gradient field with soft chromatic aberration, blurred bokeh light orbs in pink/blue/yellow, no hard subject, perfect for layering frosted glass cards on top.",
  ),
  templateInsert(
    "tpl_retro_vhs", "retro-vhs", "Retro VHS",
    "reel-animated", "RetroVHS", 20, "#ff2d92",
    '["dark","cinematic","viral"]',
    "Retro VHS still, warm-tinted CRT scanlines, mild chromatic fringing, late-90s nostalgic interior or city exterior at dusk, slight motion blur, neon magenta + cyan accents.",
  ),
  templateInsert(
    "tpl_data_story", "data-story", "Data Story",
    "reel-animated", "DataStory", 22, "#facc15",
    '["uplifting","cinematic","epic"]',
    "Editorial infographic backdrop, deep navy gradient, faint geometric line overlays, abstract data textures (charts, lines, dots) at low opacity, no real subject — leave room for a giant numeric stat.",
  ),
  templateInsert(
    "tpl_quote_spotlight", "quote-spotlight", "Quote Spotlight",
    "reel-cards", "QuoteSpotlight", 22, "#e63946",
    '["chill","minimal","ambient"]',
    "Soft sunrise gradient backdrop, warm peach to coral, painterly texture, no people in frame, leaves room for serif quote typography on top.",
  ),

  // ── new video reel template (Seedance 2.0) ───────────────────────
  templateInsert(
    "tpl_seedance_reel", "seedance-reel", "Seedance Reel (Video)",
    "reel-video", "SeedanceReel", 22, "#facc15",
    '["uplifting","cinematic","epic"]',
    "Cinematic 35mm style, soft natural lighting, single clear subject, shallow depth of field, no on-screen text. The first frame should be a striking still that the video model can animate naturally.",
  ),

  // ── KR niche-tuned templates ─────────────────────────────────────
  // These are extra "preset" rows on top of the generic 11 above. They
  // pre-bias accent color + bg prompt for Korean Instagram audiences in
  // specific verticals (finance / AI / trend), so a topic just picks one
  // by slug instead of hand-tuning every field.

  // 투자/금융 — 슈카월드 / 박곰희 톤. 차분한 navy + emerald, 데이터 중심.
  templateInsert(
    "tpl_ko_finance_data", "ko-finance-data", "투자 · Data Story",
    "reel-animated", "DataStory", 22, "#34d399",
    '["minimal","cinematic","ambient"]',
    "Editorial finance backdrop — deep navy gradient, faint candlestick chart lines at low opacity, clean Bloomberg-style ticker textures, no real subject, leave the upper-right and bottom rows empty so a giant numeric stat and headline can sit on top. Subtle emerald-green data glow.",
  ),
  templateInsert(
    "tpl_ko_finance_minimal", "ko-finance-minimal", "투자 · Minimal Grid",
    "reel-cards", "MinimalGrid", 18, "#3b82f6",
    '["minimal","ambient","chill"]',
    "Architectural minimalism, swiss-grid sober finance aesthetic, monochrome cityscape (Yeouido / Seoul financial district feel) with soft daylight, single small subject in the upper-right third, generous negative space for typography, neutral steel-blue palette.",
  ),
  templateInsert(
    "tpl_ko_finance_quote", "ko-finance-quote", "투자 · Insight Quote",
    "reel-cards", "QuoteSpotlight", 22, "#f59e0b",
    '["minimal","chill","ambient"]',
    "Soft warm beige to muted gold gradient backdrop, painterly paper texture suggesting a finance book or journal page, no people in frame, leaves room for serif quote typography. Calm, considered, magazine editorial feel — not aggressive.",
  ),

  // AI 최신 기술 — 정인성 / 김덕영 / Andrej-Karpathy 톤. 미래적이지만 과하지 않음.
  templateInsert(
    "tpl_ko_ai_glass", "ko-ai-glass", "AI · Glass Morphism",
    "reel-cards", "GlassMorphism", 20, "#22d3ee",
    '["chill","ambient","cinematic"]',
    "Futuristic Apple Vision Pro-inspired gradient field — deep purple to cyan, soft chromatic aberration, blurred bokeh light orbs, no hard subject. Very subtle suggestion of neural-net mesh or data flow at low opacity. Optimized for layering frosted glass cards on top.",
  ),
  templateInsert(
    "tpl_ko_ai_kinetic", "ko-ai-kinetic", "AI · Kinetic Type",
    "reel-animated", "KineticType", 19, "#22d3ee",
    '["epic","viral","uplifting"]',
    "Dramatic editorial backdrop with tech aesthetic — pure black field with a single shaft of cyan/teal volumetric light, suggestion of holographic or neural-net pattern at very low opacity, no human subject, ample negative space for huge typography. Mood: serious, frontier-tech.",
  ),

  // 트렌드 / 뉴스 — MZ 카드뉴스 톤.
  templateInsert(
    "tpl_ko_news_brutal", "ko-news-brutal", "속보 · Brutalist",
    "reel-cards", "NeoBrutalism", 20, "#fbbf24",
    '["viral","uplifting","epic"]',
    "Bold pop graphic backdrop in mustard-yellow risograph color with hard shadow, suggestion of a Korean newspaper front-page mast, halftone texture, single photographic subject cut out and laid over the colored field. Suitable for breaking news / hot take.",
  ),
  templateInsert(
    "tpl_ko_trend_card", "ko-trend-card", "트렌드 · Card News",
    "reel-cards", "CardNews", 18, "#ef4444",
    '["uplifting","viral","minimal"]',
    "Modern Korean Instagram card-news backdrop — soft gradient from black to deep magenta, single photographic subject (an object representing the topic), bokeh, editorial 50mm look, leaves a clean center area for a frosted glass card overlay.",
  ),

  // Threads 전용 카드 — 한국어 짧은 글에 최적화.
  templateInsert(
    "tpl_ko_threads_news", "ko-threads-news", "Threads · 한국어 뉴스",
    "threads-photo", "ThreadsCard", 0, "#fbbf24",
    '[]',
    "Sober editorial Korean news-blog backdrop — deep slate to charcoal gradient, very subtle paper grain, no subject, accent dot in mustard, leaves a clean left-aligned column for Korean serif typography (~3-4 lines).",
  ),

  // ── Engagement-pattern preset templates ─────────────────────────
  // Visual containers tuned for specific viral content patterns. The
  // persona handles the copy; these decide the look.

  // TOP-5 / 리스티클 — 트렌드·랭킹·기관 매수 종목 등 카운트다운형.
  templateInsert(
    "tpl_ko_listicle_top5", "ko-listicle-top5", "리스티클 · TOP 5",
    "reel-cards", "MinimalGrid", 18, "#f43f5e",
    '["uplifting","viral","minimal"]',
    "Bold listicle countdown backdrop, sleek crimson + ink palette, oversized faint number glyph (1, 2, 3, 4, 5) in the upper-left, single subject occupying the right two-thirds, clean studio light, leaves room for ranked-item typography.",
  ),

  // Hot Take — 의견·비교 도발형. NeoBrutalism 변형 + 핫핑크 액센트.
  templateInsert(
    "tpl_ko_hot_take", "ko-hot-take", "핫테이크 · 의견 비교",
    "reel-cards", "NeoBrutalism", 20, "#ec4899",
    '["viral","epic","uplifting"]',
    "High-contrast pop-art backdrop in hot-pink risograph, halftone dot texture, single subject cut out and offset over a thick-bordered colored field, hand-drawn arrow scribbles suggesting a comparison or callout. Punchy, attention-grabbing — fits opinion / vs. content.",
  ),

  // Before / After — 측정 결과형. 1주일 써본 결과 / X 분 → Y 분.
  templateInsert(
    "tpl_ko_before_after", "ko-before-after", "Before · After",
    "reel-animated", "DataStory", 22, "#10b981",
    '["cinematic","uplifting","epic"]',
    "Split-screen editorial backdrop, deep slate left half / emerald-tinted right half, faint chart axis textures, single object centered representing transformation, no human, leaves the full lower half empty for stat callouts comparing two states.",
  ),

  // Authority / Insight Quote — 슈카·박곰희 톤의 큰 인용문 카드.
  templateInsert(
    "tpl_ko_authority_quote", "ko-authority-quote", "권위 인용 · Authority",
    "reel-cards", "QuoteSpotlight", 22, "#f59e0b",
    '["minimal","chill","cinematic"]',
    "Editorial sunrise gradient — warm cream to muted gold, paper texture, single small object in lower-corner suggesting a journal or open book, no people, leaves full center area empty for serif quote typography. Trustworthy, magazine-cover feel.",
  ),

  // ── NCS audio seeds (user_id NULL = shared) ──────────────────────
  audioInsert("aud_ncs_1", "Heroes Tonight", "Janji feat. Johnning", "audio/ncs/heroes-tonight.mp3", 258, 128,
    '["uplifting","epic"]', "https://ncs.io/HeroesTonight",
    'Music: "Heroes Tonight" by Janji feat. Johnning [NCS Release]'),
  audioInsert("aud_ncs_2", "Cradles", "Sub Urban", "audio/ncs/cradles.mp3", 197, 95,
    '["dark","cinematic"]', "https://ncs.io/Cradles",
    'Music: "Cradles" by Sub Urban [NCS-style]'),
  audioInsert("aud_ncs_3", "Dreams", "Lost Sky", "audio/ncs/lost-sky-dreams.mp3", 211, 92,
    '["chill","minimal","vlog"]', "https://ncs.io/Dreams",
    'Music: "Dreams" by Lost Sky [NCS Release]'),

  // ── KR-niche-friendly BGM seeds ──────────────────────────────────
  // These are placeholders — drop matching mp3s into R2 at the listed
  // keys and the Worker will use them. Tagged for the new topics' mood
  // sets (finance = minimal/ambient/cinematic, ai = cinematic/ambient,
  // trend = uplifting/viral).
  audioInsert("aud_ncs_finance_1", "Quiet Strength", "ANIKA", "audio/ncs/quiet-strength.mp3", 175, 88,
    '["minimal","ambient","cinematic"]', "https://ncs.io/QuietStrength",
    'Music: "Quiet Strength" by ANIKA [NCS-style placeholder]'),
  audioInsert("aud_ncs_ai_1", "Frontier", "Distrion & Alex Skrindo", "audio/ncs/frontier.mp3", 198, 100,
    '["cinematic","ambient","epic"]', "https://ncs.io/Frontier",
    'Music: "Frontier" [NCS-style placeholder]'),
  audioInsert("aud_ncs_trend_1", "Sunrise", "Jim Yosef", "audio/ncs/sunrise.mp3", 220, 128,
    '["uplifting","viral","epic"]', "https://ncs.io/Sunrise",
    'Music: "Sunrise" by Jim Yosef [NCS Release]'),
];

function templateInsert(
  id: string,
  slug: string,
  name: string,
  kind: "reel-cards" | "reel-animated" | "reel-video" | "threads-photo",
  compositionId: string,
  durationSec: number,
  accentColor: string,
  defaultAudioMood: string,
  bgPromptTemplate: string,
) {
  const platform = kind === "threads-photo" ? "threads" : "instagram";
  return {
    sql: `INSERT OR IGNORE INTO templates
      (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
       duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
       bg_mode, default_bg_r2_key, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, 1, 1, ?, ?, 'fade', 'ai', '', ?, ?)`,
    params: [id, slug, name, kind, platform, compositionId, defaultAudioMood, durationSec, accentColor, bgPromptTemplate, now, now],
  };
}

function audioInsert(id: string, name: string, artist: string, key: string, dur: number, bpm: number, moods: string, license: string, attribution: string) {
  return {
    sql: `INSERT OR IGNORE INTO audio_tracks
      (id, user_id, name, artist, source, r2_key, duration_sec, bpm, mood_tags, license_url, attribution_text, enabled, created_at, updated_at)
      VALUES (?, NULL, ?, ?, 'ncs', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    params: [id, name, artist, key, dur, bpm, moods, license, attribution, now, now],
  };
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
let ok = 0, fail = 0;
for (const stmt of STATEMENTS) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(stmt),
  });
  const body = await res.text();
  if (res.ok) { ok++; console.log(`  ✓ ${stmt.params[1] ?? stmt.params[0]}`); }
  else { fail++; console.error(`  ✗ ${stmt.params[1] ?? stmt.params[0]}: ${res.status} ${body.slice(0, 200)}`); }
}
console.log(`\nDone: ${ok} ok, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} env var is required`);
    process.exit(1);
  }
  return v;
}
