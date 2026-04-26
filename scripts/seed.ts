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
