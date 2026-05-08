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
//
// The 11 templates seeded below are the curated set after the May 2026
// magazine-grade redesign. Each is anchored to a specific real publication
// (NYT Magazine, Monocle, RISOTTO Studio, Vogue, Wallpaper*) so the deck
// reads as a real publication rather than "AI card-news". The
// `bgPromptTemplate` for each template encodes the publication's
// photographic register; the orchestrator concatenates it after
// `topic.imageStylePrompt` and before the use-case/constraints lines.
//
// To migrate an existing deployment from the old 20+ templates to this
// curated set, run `bun scripts/migrate-templates.ts` after seeding —
// it disables the old slugs and reassigns each topic's templateSlugs[]
// to the closest new equivalent based on the persona prompt.

const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const databaseId = required("D1_DATABASE_ID");
const token = required("CLOUDFLARE_API_TOKEN");

const now = Date.now();

const STATEMENTS: { sql: string; params: unknown[] }[] = [
  // ── 5 magazine-grade card templates ────────────────────────────
  // Editorial — NYT Magazine / The New Yorker / Cereal lineage.
  // Two-column page: left text, right photo. Calm, trustworthy. Default
  // for cultured trends, opinion, lifestyle essays.
  templateInsert(
    "tpl_editorial", "editorial-default", "Editorial — NYT Magazine",
    "reel-cards", "Editorial", 21, "#a8201a",
    '["chill","minimal","cinematic"]',
    "NYT Magazine editorial documentary aesthetic — 35mm or medium-format film feel, single overcast or window light from one named direction, real skin and surface texture (visible pores, dust on objects, paper grain, fabric weave), composition reads as caught-in-the-moment reportage, never a posed studio composite. Warm paper-cream non-image areas (#f8f4ec); muted earth tones in the photo with one quiet brick-red or oxblood accent on a single small surface only (a sign, a fabric, a label). Photograph occupies the right two-thirds of the frame; the left vertical column is intentionally empty for typography.",
  ),

  // Monocle — Monocle / Bloomberg Businessweek / FT Weekend lineage.
  // Hairline-mast briefing layout with a horizontal photo strip and a
  // ledger-style stat at the bottom. Default for data-heavy finance / news.
  templateInsert(
    "tpl_monocle", "monocle-brief", "Monocle — Briefing",
    "reel-cards", "Monocle", 22, "#d8534a",
    '["minimal","ambient","cinematic"]',
    "Monocle / Bloomberg Businessweek press-room aesthetic — low-key environmental still life or commodity-object photography, single soft-overcast or single mixed-fluorescent light, low overall contrast. Restrained reportage: a desk corner with paper printouts and a coffee ring, a measured object on linen, a Yeouido or Marunouchi street detail at low elevation. Deep press-room navy (#0e2a47) and paper cream (#f4ecdd) dominate; one Monocle-style coral red appears on a single surface only — never the whole photo. Subject centered horizontally; upper third of the frame is plain so a kicker bar can sit above.",
  ),

  // Riso — RISOTTO Studio / Print magazine / Bloomberg-collage. Solid
  // poster color + halftone-stripped photo + hand-drawn arrow.
  templateInsert(
    "tpl_riso", "riso-poster", "Riso — Hot Poster",
    "reel-cards", "Riso", 21, "#ef3340",
    '["uplifting","viral","epic"]',
    "RISOTTO Studio / Print magazine poster aesthetic — single subject photographed flat against a solid colored seamless paper backdrop, one hard key light from the side producing a short crisp shadow, color separation pushed deliberately so faint cyan/magenta dot misregistration is visible on midtones (offset-print artifact, NOT digital glow). Subject is everyday and slightly absurd: a ripe persimmon balanced on a rotary phone, a stack of Polaroids on red linoleum, a single shoe on a colored tile. Pantone-032c hot red (#ef3340) and paper cream (#f4ecdd) carry the page. Subject centered; upper 25% of frame stays as plain colored backdrop for headline overlay.",
  ),

  // Cover — Vogue / W / Numéro fashion-cover lineage. Full-bleed photo
  // with a serif italic title that crops into the subject.
  templateInsert(
    "tpl_cover", "cover-feature", "Cover — Vogue / Numéro",
    "reel-cards", "Cover", 22, "#c8a04f",
    '["chill","cinematic","ambient"]',
    "Fashion-cover editorial portrait or still life — Vogue / W / Numéro lineage. Single subject occupying the central upper half of the frame, full-bleed, charcoal or muted neutral surroundings. Light restrained — single softbox or window light, no studio glare, no rim-light cliché. The subject IS the cover: a person photographed at the shoulder line (face partially in shadow), or a still life arranged like a fashion editorial (a wool coat over a chair, a single ceramic vessel on linen). Tonal palette stays cool and minimal except for one warm-metal accent (burnished gold, polished brass, aged bronze) on a single small surface.",
  ),

  // Index — Wallpaper* / 032c / Index magazine. Black field, oversized
  // numeral, gridded tickers, single chartreuse accent. Frontier-tech.
  templateInsert(
    "tpl_index", "index-frontier", "Index — Wallpaper* / 032c",
    "reel-cards", "Index032c", 20, "#cfff3c",
    '["epic","viral","cinematic"]',
    "Wallpaper* / 032c / Index magazine editorial photography — industrial-design product shots or environmental architecture photography. Single subject photographed on an infinite cyc or tight-framed against a plain dark wall, single hard light source from the side producing one clean shadow, deep matte blacks dominating the negative space. Rigorously gridded: subject occupies one rectangle of the frame, the rest is empty matte black. One acid chartreuse-yellow note on a single small surface only (a label, a sticker, an LED, a packaging detail). No human portraits, no studio glamour, no neon glow.",
  ),

  // ── 5 KR-niche default presets ─────────────────────────────────
  // These pre-bias accent + bgPromptTemplate for Korean Instagram audiences
  // in specific verticals so a topic just picks one by slug.

  // 투자/금융 — Monocle 톤. 차분한 navy + coral, 데이터 중심.
  templateInsert(
    "tpl_ko_finance_monocle", "ko-finance-monocle", "투자 · Monocle Brief",
    "reel-cards", "Monocle", 22, "#d8534a",
    '["minimal","ambient","cinematic"]',
    "Korean financial-press editorial photo — Monocle-meets-Maeil-Business aesthetic. Subjects: a Yeouido high-rise lobby at low elevation, a printed Bloomberg Terminal page with red-pen circles, a coffee mug beside an open accounting ledger, a tax stamp on cream paper, a stainless-steel handrail of a Seoul subway station at off-peak. Single overcast or fluorescent light, low contrast, navy and paper-cream palette, one coral-red note on a single surface (a stamp, a stock-ticker LED, a folder spine). Subject central; upper third plain so a 'BRIEFING / SEOUL' kicker bar can sit above.",
  ),

  // AI / 기술 — Index 032c 톤. 검정 + 형광노랑.
  templateInsert(
    "tpl_ko_ai_index", "ko-ai-index", "AI · Index Frontier",
    "reel-cards", "Index032c", 20, "#cfff3c",
    '["epic","cinematic","viral"]',
    "Korean tech-press industrial-product photography — 032c / Wallpaper* register applied to AI/dev tooling subjects. A single subject on a matte-black surface or against a plain dark wall: a mechanical keycap, an SSD on its side, a printed circuit-board edge, a stainless-steel laptop hinge, a Korean mechanical keyboard with hangul-engraved keycaps, a lone server-rack ear bracket. One hard key light from the side, deep blacks dominating, no glamour. One acid chartreuse note on a single small surface (a status LED, a packaging sticker, a port label).",
  ),

  // 트렌드 / MZ — Riso poster 톤.
  templateInsert(
    "tpl_ko_trend_riso", "ko-trend-riso", "트렌드 · Riso Poster",
    "reel-cards", "Riso", 21, "#ef3340",
    '["uplifting","viral","epic"]',
    "Korean MZ-trend riso-poster aesthetic — RISOTTO Studio register applied to a Korean street or domestic subject. A single subject photographed flat on a hot-red seamless: a Mexican-pepper-shaped lighter from a Hongdae convenience store, a Joseon Univ. rally pin from the 1990s, a parking ticket stuck under a wiper, a scratch-card lottery on a tile floor, a thin paper cup of soju at noon. Hard side light, faint cyan-magenta misregistration visible. Pantone-032c red carrying the largest area, paper cream margins. Subject central, upper 25% plain hot-red for headline.",
  ),

  // 에세이 / 오피니언 — Editorial 톤. 차분.
  templateInsert(
    "tpl_ko_essay_editorial", "ko-essay-editorial", "에세이 · Editorial",
    "reel-cards", "Editorial", 21, "#a8201a",
    '["chill","minimal","cinematic"]',
    "Korean essay-magazine documentary photography — NYT Magazine register applied to ordinary Korean domestic life. Subjects: a half-empty mug on a Yeouido windowsill at 7am with the city haze behind, a worn wooden floor with a paperback cracked open, a metal shutter door of a Sangdo-dong side-alley shop at dusk with a hand-painted '오늘 마감' sign, a pair of weathered hands wrapping a paper bag at a Mangwon-dong bakery. 35mm film feel, single window light from one direction, real surface texture (chipped paint, dog-eared paper, condensation on glass). Warm paper-cream non-image areas, muted earth tones in the photo, one brick-red accent on a single small surface only.",
  ),

  // 인용/명상 — Cover 톤. 시간/관조.
  templateInsert(
    "tpl_ko_quote_cover", "ko-quote-cover", "인용 · Cover Feature",
    "reel-cards", "Cover", 22, "#c8a04f",
    '["chill","cinematic","minimal"]',
    "Korean lifestyle-cover editorial portraiture — Vogue Korea / W Korea register applied to quiet contemplative subjects. A single subject occupying the central upper half: a person seen from the shoulder up at a window in shadow, a porcelain teacup beside a paperback, a wool coat draped over a vintage chair, a single calligraphy brush on raw linen, a porcelain bowl half-filled with water on a wooden tray. Charcoal or muted-neutral surroundings, single soft window light from one side, full-bleed composition. One burnished-gold note on a single surface (a brass rim, a lettering pen tip, a pendant).",
  ),

  // ── Threads card (system default) ──────────────────────────────
  // The new ThreadsCard composition uses the editorial palette by default.
  templateInsert(
    "tpl_threads_editorial", "threads-editorial", "Threads · Editorial Dispatch",
    "threads-photo", "ThreadsCard", 0, "#a8201a",
    '[]',
    "Korean editorial dispatch backdrop for a Threads still — NYT Magazine register, paper-cream backdrop, single muted subject in the upper photo zone (a hand on a window, a corner of a desk, a steam-rising mug at dawn), 50mm soft window light, one quiet brick accent. Leaves room for kicker + serif headline + body in the lower half. Never bake on-screen text into the image.",
  ),

  // ── Video (Seedance 2.0) — keep ────────────────────────────────
  templateInsert(
    "tpl_seedance_reel", "seedance-reel", "Seedance Reel (Video)",
    "reel-video", "SeedanceReel", 22, "#cfff3c",
    '["uplifting","cinematic","epic"]',
    "Cinematic 35mm film feel, soft natural lighting, single clear subject, shallow depth of field, no on-screen text. The first frame is a striking still that the video model can animate naturally — an action half-frozen, not a posed end-frame. Documentary register, never glossy CGI.",
  ),

  // ── NCS audio seeds (user_id NULL = shared) ────────────────────
  audioInsert("aud_ncs_1", "Heroes Tonight", "Janji feat. Johnning", "audio/ncs/heroes-tonight.mp3", 258, 128,
    '["uplifting","epic"]', "https://ncs.io/HeroesTonight",
    'Music: "Heroes Tonight" by Janji feat. Johnning [NCS Release]'),
  audioInsert("aud_ncs_2", "Cradles", "Sub Urban", "audio/ncs/cradles.mp3", 197, 95,
    '["dark","cinematic"]', "https://ncs.io/Cradles",
    'Music: "Cradles" by Sub Urban [NCS-style]'),
  audioInsert("aud_ncs_3", "Dreams", "Lost Sky", "audio/ncs/lost-sky-dreams.mp3", 211, 92,
    '["chill","minimal","vlog"]', "https://ncs.io/Dreams",
    'Music: "Dreams" by Lost Sky [NCS Release]'),

  // ── KR-niche-friendly BGM seeds ────────────────────────────────
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
