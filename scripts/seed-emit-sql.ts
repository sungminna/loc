// Helper that mirrors the statement list from seed.ts and emits inline SQL
// to stdout so wrangler d1 execute --file can run it against remote D1
// without needing a CF API token.
//
// Usage:
//   bun scripts/seed-emit-sql.ts > /tmp/seed.sql
//   bunx wrangler d1 execute loc-app --remote --file=/tmp/seed.sql
//
// Column names + INSERT shape MUST stay in sync with scripts/seed.ts.

const now = Date.now();

const STATEMENTS: { sql: string; params: unknown[] }[] = [];

function templateInsert(
  id: string, slug: string, name: string,
  kind: "reel-cards" | "reel-animated" | "reel-video" | "threads-photo",
  compositionId: string, durationSec: number, accentColor: string,
  defaultAudioMood: string, bgPromptTemplate: string,
): void {
  const platform = kind === "threads-photo" ? "threads" : "instagram";
  STATEMENTS.push({
    sql: `INSERT OR IGNORE INTO templates
      (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
       duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
       bg_mode, default_bg_r2_key, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, 1, 1, ?, ?, 'fade', 'ai', '', ?, ?)`,
    params: [id, slug, name, kind, platform, compositionId, defaultAudioMood, durationSec, accentColor, bgPromptTemplate, now, now],
  });
}

function audioInsert(
  id: string, name: string, artist: string, key: string, dur: number, bpm: number,
  moods: string, license: string, attribution: string,
): void {
  STATEMENTS.push({
    sql: `INSERT OR IGNORE INTO audio_tracks
      (id, user_id, name, artist, source, r2_key, duration_sec, bpm, mood_tags, license_url, attribution_text, enabled, created_at, updated_at)
      VALUES (?, NULL, ?, ?, 'ncs', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    params: [id, name, artist, key, dur, bpm, moods, license, attribution, now, now],
  });
}

// ── generic shared cards (mirror seed.ts header) ──────────────────────
STATEMENTS.push({
  sql: `INSERT OR IGNORE INTO templates
    (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
     duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
     bg_mode, default_bg_r2_key, created_at, updated_at)
    VALUES (?, NULL, ?, ?, 'reel-cards', 'instagram', 'CardNews', '{}', '{}', ?, 18, 1, 1, '#ffe45c', '', 'fade', 'ai', '', ?, ?)`,
  params: ["tpl_card_news_default", "card-news-default", "Card News (default)", '["uplifting","minimal"]', now, now],
});
STATEMENTS.push({
  sql: `INSERT OR IGNORE INTO templates
    (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
     duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
     bg_mode, default_bg_r2_key, created_at, updated_at)
    VALUES (?, NULL, ?, ?, 'threads-photo', 'threads', 'ThreadsCard', '{}', '{}', '[]', 0, 1, 1, '#fbbf24', '', 'fade', 'ai', '', ?, ?)`,
  params: ["tpl_threads_card_default", "threads-card-default", "Threads Card (default)", now, now],
});

// ── 8 generic style templates ─────────────────────────────────────────
templateInsert("tpl_kinetic_type", "kinetic-type", "Kinetic Type", "reel-animated", "KineticType", 19, "#ffe45c",
  '["uplifting","epic","viral"]',
  "Cinematic editorial backdrop, ultra-high contrast monochrome with a single vivid accent, minimal subject, soft volumetric light, 50mm lens, shallow depth of field. Leave large empty negative space for typography.");
templateInsert("tpl_bold_editorial", "bold-editorial", "Bold Editorial", "reel-cards", "BoldEditorial", 21, "#e63946",
  '["chill","minimal","cinematic"]',
  "Editorial magazine still life, warm natural light, paper-textured backdrop, single hero subject offset to the right two-thirds, muted earthy palette with a single saturated accent.");
templateInsert("tpl_minimal_grid", "minimal-grid", "Minimal Grid", "reel-cards", "MinimalGrid", 18, "#ffe45c",
  '["minimal","ambient","vlog"]',
  "Architectural minimalism, swiss-grid composition, monochrome black/white photography with soft daylight, single subject in lower-right third, generous negative space.");
templateInsert("tpl_neo_brutalism", "neo-brutalism", "Neo Brutalism", "reel-cards", "NeoBrutalism", 20, "#ff2d55",
  '["uplifting","viral","epic"]',
  "Bold pop graphic backdrop, flat saturated risograph color, hard shadows, halftone texture, photographic subject cut out and laid over a thick-bordered colored field.");
templateInsert("tpl_glass_morph", "glass-morphism", "Glass Morphism", "reel-cards", "GlassMorphism", 20, "#a78bfa",
  '["chill","ambient","minimal"]',
  "Dreamy gradient field with soft chromatic aberration, blurred bokeh light orbs in pink/blue/yellow, no hard subject, perfect for layering frosted glass cards on top.");
templateInsert("tpl_retro_vhs", "retro-vhs", "Retro VHS", "reel-animated", "RetroVHS", 20, "#ff2d92",
  '["dark","cinematic","viral"]',
  "Retro VHS still, warm-tinted CRT scanlines, mild chromatic fringing, late-90s nostalgic interior or city exterior at dusk, slight motion blur, neon magenta + cyan accents.");
templateInsert("tpl_data_story", "data-story", "Data Story", "reel-animated", "DataStory", 22, "#facc15",
  '["uplifting","cinematic","epic"]',
  "Editorial infographic backdrop, deep navy gradient, faint geometric line overlays, abstract data textures (charts, lines, dots) at low opacity, no real subject — leave room for a giant numeric stat.");
templateInsert("tpl_quote_spotlight", "quote-spotlight", "Quote Spotlight", "reel-cards", "QuoteSpotlight", 22, "#e63946",
  '["chill","minimal","ambient"]',
  "Editorial paper backdrop, soft warm lighting, suggestion of an open book or worn journal page, no people, leaves room for serif typography overlay. Calm, considered, magazine feel.");
templateInsert("tpl_seedance_reel", "seedance-reel", "Seedance Reel", "reel-video", "SeedanceReel", 18, "#7c3aed",
  '["cinematic","epic","ambient"]',
  "Cinematic 35mm style, soft natural lighting, single clear subject, shallow depth of field, no on-screen text. The first frame should be a striking still that the video model can animate naturally.");

// ── KR niche-tuned templates ─────────────────────────────────────
templateInsert("tpl_ko_finance_data", "ko-finance-data", "투자 · Data Story", "reel-animated", "DataStory", 22, "#34d399",
  '["minimal","cinematic","ambient"]',
  "Editorial finance backdrop — deep navy gradient, faint candlestick chart lines at low opacity, clean Bloomberg-style ticker textures, no real subject, leave the upper-right and bottom rows empty so a giant numeric stat and headline can sit on top. Subtle emerald-green data glow.");
templateInsert("tpl_ko_finance_minimal", "ko-finance-minimal", "투자 · Minimal Grid", "reel-cards", "MinimalGrid", 18, "#3b82f6",
  '["minimal","ambient","chill"]',
  "Architectural minimalism, swiss-grid sober finance aesthetic, monochrome cityscape (Yeouido / Seoul financial district feel) with soft daylight, single small subject in the upper-right third, generous negative space for typography, neutral steel-blue palette.");
templateInsert("tpl_ko_finance_quote", "ko-finance-quote", "투자 · Insight Quote", "reel-cards", "QuoteSpotlight", 22, "#f59e0b",
  '["minimal","chill","ambient"]',
  "Soft warm beige to muted gold gradient backdrop, painterly paper texture suggesting a finance book or journal page, no people in frame, leaves room for serif quote typography. Calm, considered, magazine editorial feel — not aggressive.");
templateInsert("tpl_ko_ai_glass", "ko-ai-glass", "AI · Glass Morphism", "reel-cards", "GlassMorphism", 20, "#22d3ee",
  '["chill","ambient","cinematic"]',
  "Futuristic Apple Vision Pro-inspired gradient field — deep purple to cyan, soft chromatic aberration, blurred bokeh light orbs, no hard subject. Very subtle suggestion of neural-net mesh or data flow at low opacity. Optimized for layering frosted glass cards on top.");
templateInsert("tpl_ko_ai_kinetic", "ko-ai-kinetic", "AI · Kinetic Type", "reel-animated", "KineticType", 19, "#22d3ee",
  '["epic","viral","uplifting"]',
  "Dramatic editorial backdrop with tech aesthetic — pure black field with a single shaft of cyan/teal volumetric light, suggestion of holographic or neural-net pattern at very low opacity, no human subject, ample negative space for huge typography. Mood: serious, frontier-tech.");
templateInsert("tpl_ko_news_brutal", "ko-news-brutal", "속보 · Brutalist", "reel-cards", "NeoBrutalism", 20, "#fbbf24",
  '["viral","uplifting","epic"]',
  "Bold pop graphic backdrop in mustard-yellow risograph color with hard shadow, suggestion of a Korean newspaper front-page mast, halftone texture, single photographic subject cut out and laid over the colored field. Suitable for breaking news / hot take.");
templateInsert("tpl_ko_trend_card", "ko-trend-card", "트렌드 · Card News", "reel-cards", "CardNews", 18, "#ef4444",
  '["uplifting","viral","minimal"]',
  "Modern Korean Instagram card-news backdrop — soft gradient from black to deep magenta, single photographic subject (an object representing the topic), bokeh, editorial 50mm look, leaves a clean center area for a frosted glass card overlay.");
templateInsert("tpl_ko_threads_news", "ko-threads-news", "Threads · 한국어 뉴스", "threads-photo", "ThreadsCard", 0, "#fbbf24",
  '[]',
  "Sober editorial Korean news-blog backdrop — deep slate to charcoal gradient, very subtle paper grain, no subject, accent dot in mustard, leaves a clean left-aligned column for Korean serif typography (~3-4 lines).");
templateInsert("tpl_ko_listicle_top5", "ko-listicle-top5", "리스티클 · TOP 5", "reel-cards", "MinimalGrid", 18, "#f43f5e",
  '["uplifting","viral","minimal"]',
  "Bold listicle countdown backdrop, sleek crimson + ink palette, oversized faint number glyph (1, 2, 3, 4, 5) in the upper-left, single subject occupying the right two-thirds, clean studio light, leaves room for ranked-item typography.");
templateInsert("tpl_ko_hot_take", "ko-hot-take", "핫테이크 · 의견 비교", "reel-cards", "NeoBrutalism", 20, "#ec4899",
  '["viral","epic","uplifting"]',
  "High-contrast pop-art backdrop in hot-pink risograph, halftone dot texture, single subject cut out and offset over a thick-bordered colored field, hand-drawn arrow scribbles suggesting a comparison or callout. Punchy, attention-grabbing — fits opinion / vs. content.");
templateInsert("tpl_ko_before_after", "ko-before-after", "Before · After", "reel-animated", "DataStory", 22, "#10b981",
  '["cinematic","uplifting","epic"]',
  "Split-screen editorial backdrop, deep slate left half / emerald-tinted right half, faint chart axis textures, single object centered representing transformation, no human, leaves the full lower half empty for stat callouts comparing two states.");
templateInsert("tpl_ko_authority_quote", "ko-authority-quote", "권위 인용 · Authority", "reel-cards", "QuoteSpotlight", 22, "#f59e0b",
  '["minimal","chill","cinematic"]',
  "Editorial sunrise gradient — warm cream to muted gold, paper texture, single small object in lower-corner suggesting a journal or open book, no people, leaves full center area empty for serif quote typography. Trustworthy, magazine-cover feel.");

// ── NCS audio ─────────────────────────────────────────────────────────
audioInsert("aud_ncs_1", "Heroes Tonight", "Janji feat. Johnning", "audio/ncs/heroes-tonight.mp3", 258, 128,
  '["uplifting","epic"]', "https://ncs.io/HeroesTonight",
  'Music: "Heroes Tonight" by Janji feat. Johnning [NCS Release]');
audioInsert("aud_ncs_2", "Cradles", "Sub Urban", "audio/ncs/cradles.mp3", 197, 95,
  '["dark","cinematic"]', "https://ncs.io/Cradles",
  'Music: "Cradles" by Sub Urban [NCS-style]');
audioInsert("aud_ncs_3", "Dreams", "Lost Sky", "audio/ncs/lost-sky-dreams.mp3", 211, 92,
  '["chill","minimal","vlog"]', "https://ncs.io/Dreams",
  'Music: "Dreams" by Lost Sky [NCS Release]');
audioInsert("aud_ncs_finance_1", "Quiet Strength", "ANIKA", "audio/ncs/quiet-strength.mp3", 175, 88,
  '["minimal","ambient","cinematic"]', "https://ncs.io/QuietStrength",
  'Music: "Quiet Strength" by ANIKA [NCS-style placeholder]');
audioInsert("aud_ncs_ai_1", "Frontier", "Distrion & Alex Skrindo", "audio/ncs/frontier.mp3", 198, 100,
  '["cinematic","ambient","epic"]', "https://ncs.io/Frontier",
  'Music: "Frontier" [NCS-style placeholder]');
audioInsert("aud_ncs_trend_1", "Sunrise", "Jim Yosef", "audio/ncs/sunrise.mp3", 220, 128,
  '["uplifting","viral","epic"]', "https://ncs.io/Sunrise",
  'Music: "Sunrise" by Jim Yosef [NCS Release]');

function quote(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

for (const stmt of STATEMENTS) {
  let i = 0;
  const sql = stmt.sql.replace(/\?/g, () => quote(stmt.params[i++]));
  console.log(sql.replace(/\s+/g, " ").trim() + ";");
}
