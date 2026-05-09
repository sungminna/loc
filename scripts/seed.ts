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
// 2026-trend-driven redesign (Aurora · Gummy · Zine · Kinetic · Dossier).
// Each composition occupies a distinct visual register and motion grammar:
//
//   Aurora   — Atmospheric Gradients (Cool Blue / Drama Club). Cinematic
//              radial gradient field, parallax-floating type, full-bleed
//              image with vertical scrim. Default for cultured / opinion.
//   Gummy    — Hyperreal 3D / Tactile (Gimme Gummy). Rounded 3D candy
//              tiles, jelly springs, photo inside a tilted rounded card.
//              Default for trend / playful / MZ vibes.
//   Zine     — Counterculture / Pick-and-Mix. Ransom-note collage,
//              halftone-clipped torn-edge image, mono ticker.
//              Default for irreverent / opinion.
//   Kinetic  — Typographic Maximalism. Strict B&W + one neon, variable
//              wght axis morph, type fills the slide. Default for tech /
//              data / AI verticals.
//   Dossier  — Micrographics / Heritage / Blueprint. Italic editorial
//              serif, blueprint cyan grid, registration marks, stat
//              labels. Default for finance / data-heavy briefings.
//
// To migrate an existing deployment from the prior set (Editorial /
// Monocle / Riso / Cover / Index032c), run `bun scripts/migrate-templates.ts`
// after seeding — it disables the old slugs and reassigns each topic's
// templateSlugs[] to the closest new equivalent based on the persona prompt.

const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const databaseId = required("D1_DATABASE_ID");
const token = required("CLOUDFLARE_API_TOKEN");

const now = Date.now();

const STATEMENTS: { sql: string; params: unknown[] }[] = [
  // ── 5 magazine-grade card templates ────────────────────────────

  // Aurora — atmospheric gradient. Cinematic, ambient, opinion-friendly.
  templateInsert(
    "tpl_aurora", "aurora-default", "Aurora — Atmospheric Gradient",
    "reel-cards", "Aurora", 22, "#ff6b9d",
    '["chill","ambient","cinematic"]',
    "Atmospheric gradient cinematography — Cool Blue / Drama Club register. Subjects: a single subject silhouetted against deep navy / opal-lilac volumetric haze; a hand or object emerging from cool gradient fog; a horizon line at twilight where indigo bleeds into lilac. Single soft directional light from one named direction (window, dusk sky, fog-scattered overhead). Cool palette dominates (#0a0e2a navy → #6a76d8 → #c8b8ff lilac); one cosmic-pink note (#ff6b9d) on a single small surface only. Subject occupies the central vertical band; upper third stays as plain gradient field for headline overlay. No glamour, no studio strobes — only ambient color and depth.",
  ),

  // Gummy — hyperreal 3D candy tile. Tactile, playful, MZ-trend.
  templateInsert(
    "tpl_gummy", "gummy-default", "Gummy — Hyperreal 3D Candy",
    "reel-cards", "Gummy", 21, "#ff5b9d",
    '["uplifting","viral","epic"]',
    "Hyperreal-3D tactile photography — Gimme Gummy / Hyperreal-3D-Worlds register. Subjects: a single object photographed flat on a butter-cream seamless backdrop with one hard side light producing a short crisp shadow — a glossy gummy candy, a translucent jelly phone case, a chunky rubber duck, a soft plush keychain on a bubblegum-pink tile. Material reads tactile (glossy-soft, gel-like, rubber). Saturated candy palette: butter cream #fff5d6 backdrop with one bubblegum-pink (#ff5b9d) or electric-lime (#c8ff3c) accent on a single small surface. Subject centered with breathing space; upper 25% plain backdrop for headline tile overlay. Never CGI-glassy; the photo register is real-object-on-paper.",
  ),

  // Zine — punk collage. Counterculture, irreverent, opinion.
  templateInsert(
    "tpl_zine", "zine-default", "Zine — Counterculture Collage",
    "reel-cards", "Zine", 21, "#ee2a32",
    '["uplifting","viral","cinematic"]',
    "Punk-zine photocopy register — Counterculture-Codes / Pick-and-Mix / Warning-Low-Ink. Subjects: a single subject photographed against #f4f0e6 newsprint paper or scanned from an actual photocopy: a torn ticket stub, a half-faded receipt, a stencilled wall, a tape-marked cardboard, a hand-drawn mark on lined paper, a knockoff-store storefront sign. High contrast, visible cyan/magenta misregistration on midtones, faint photocopy debris, paper grain. Pantone-032c risograph red (#ee2a32) and acid yellow (#e8ff2c) carry the page; black ink dominates negative space. Subject central; upper 25% plain newsprint paper for headline + ransom-note kicker overlay.",
  ),

  // Kinetic — typographic maximalism. Tech, AI, data, frontier.
  templateInsert(
    "tpl_kinetic", "kinetic-default", "Kinetic — Typographic Maximalism",
    "reel-cards", "Kinetic", 21, "#d8ff00",
    '["epic","viral","cinematic"]',
    "Strict black-field industrial photography — Typographic-Maximalism / Counterculture-Codes register. Subjects: a single hard-lit subject against pure matte black, photographed at oblique angle so the shadow does most of the work — a stainless edge, a server-rack ear bracket, a printed circuit-board trace, a single key-cap, a steel cable end, a polished hinge. Deep blacks dominate; subject occupies one tight rectangle of the frame (image becomes a small inset stamp behind huge typography in the layout). One acid chartreuse-yellow note (#d8ff00) on a single surface only (an LED, a sticker, a port label). No glamour, no neon glow, no human portraits.",
  ),

  // Dossier — micrographics / blueprint. Finance, data-heavy briefings.
  templateInsert(
    "tpl_dossier", "dossier-default", "Dossier — Micrographics / Blueprint",
    "reel-cards", "Dossier", 22, "#a8201a",
    '["minimal","ambient","cinematic"]',
    "Specimen-sheet documentary photography — Micrographics / Heritage / Hand-Crafted register. Subjects: a single object on warm cream paper #f1ead6 photographed top-down or near-top-down with a faint blueprint-grid printed beneath — a folded letter on a desk, a magnifying-glass beside printed data, a typewriter ribbon, a fountain-pen on linen, a brass compass on architectural drafting paper. Single overcast or single window light, low contrast, paper grain visible. Cream paper + ink-black + a single blueprint-cyan (#2c5e8c) note (a stamp, an ink mark, a ribbon edge) and one crimson (#a8201a) FILED stamp on a single small surface. Subject central, top half clear for italic-serif headline + corner registration ticks.",
  ),

  // ── 5 KR-niche default presets ─────────────────────────────────
  // These pre-bias accent + bgPromptTemplate for Korean Instagram audiences
  // in specific verticals so a topic just picks one by slug.

  // 투자/금융 — Dossier (data-heavy specimen).
  templateInsert(
    "tpl_ko_finance_dossier", "ko-finance-dossier", "투자 · Dossier Brief",
    "reel-cards", "Dossier", 22, "#a8201a",
    '["minimal","ambient","cinematic"]',
    "Korean financial-specimen photography — Dossier register applied to Yeouido / 강남 finance subjects. A single object on warm cream paper with a faint blueprint grid: a printed stock-ticker page with red-pen circles, a folded Bloomberg printout beside a fountain pen, a brass paperweight on cream linen, a typed memo with a 도장 stamp, a calculator on linen-laid paper, a magnifying glass over a Maeil-Business article. Single overcast light, low contrast, paper grain visible. Crimson (#a8201a) on a single surface (a stamp, a ribbon, a circle of red ink); one blueprint-cyan note (a ledger ruling, an ink mark). Subject central, top half clear for italic serif headline + corner registration ticks.",
  ),

  // AI / 기술 — Kinetic (typographic maximalism).
  templateInsert(
    "tpl_ko_ai_kinetic", "ko-ai-kinetic", "AI · Kinetic Frontier",
    "reel-cards", "Kinetic", 21, "#d8ff00",
    '["epic","cinematic","viral"]',
    "Korean tech-press industrial photography — Kinetic register applied to AI/dev tooling. A single subject on matte black or against a plain dark wall: a Korean mechanical keyboard with hangul-engraved keycaps, a stainless-steel laptop hinge edge, an SSD on its side, a single PCB trace, a server-rack ear bracket. One hard side light, deep blacks dominating. The image will become a small inset stamp behind huge type in the layout, so frame the subject tight with empty matte-black around it. One acid chartreuse note (#d8ff00) on a single small surface (a status LED, a packaging label, a port mark).",
  ),

  // 트렌드 / MZ — Gummy (hyperreal 3D candy).
  templateInsert(
    "tpl_ko_trend_gummy", "ko-trend-gummy", "트렌드 · Gummy Candy",
    "reel-cards", "Gummy", 21, "#ff5b9d",
    '["uplifting","viral","epic"]',
    "Korean MZ-trend tactile photography — Gummy register applied to Korean street/domestic objects. A single subject photographed flat against a butter-cream seamless: a glossy 약과 gummy on a pink tile, a 띠부띠부씰 sticker collection on a butter-cream backdrop, a translucent 추파춥스 jelly, a chunky 새콤달콤 candy bar, a soft plush 인생네컷 photo strip on a bubblegum tile. Hard side light, faint shadow, real-object-on-paper register (no CGI glass). One bubblegum-pink (#ff5b9d) or electric-lime (#c8ff3c) note carries the page. Upper 25% plain backdrop for headline-tile overlay.",
  ),

  // 에세이 / 오피니언 — Aurora (atmospheric gradient).
  templateInsert(
    "tpl_ko_essay_aurora", "ko-essay-aurora", "에세이 · Aurora",
    "reel-cards", "Aurora", 22, "#ff6b9d",
    '["chill","minimal","cinematic"]',
    "Korean essay-magazine atmospheric photography — Aurora register applied to ordinary Korean domestic life under cool gradient light. Subjects: a half-empty mug on a Yeouido windowsill at 7am with the city haze behind, a worn wooden floor with a paperback cracked open, a metal shutter door of a Sangdo-dong side-alley shop at dusk, a pair of weathered hands wrapping a paper bag at a Mangwon-dong bakery — but always under cool ambient gradient atmosphere (deep navy → opal lilac fog). Single soft directional light. Cool palette dominates; one cosmic-pink note (#ff6b9d) on a single small surface only.",
  ),

  // 인용/명상 — Zine (counterculture collage applied to quiet quotes).
  templateInsert(
    "tpl_ko_quote_zine", "ko-quote-zine", "인용 · Zine Collage",
    "reel-cards", "Zine", 21, "#ee2a32",
    '["chill","cinematic","minimal"]',
    "Korean quote-card photocopy register — Zine applied to contemplative subjects. A single subject on newsprint paper (#f4f0e6), photographed flat or scanned: a folded letter, a paperback page with a marker line, a tape-marked envelope, a torn poetry magazine spread, a hand-drawn mark on lined paper, a calligraphy 붓 brush on hanji paper. High contrast, faint photocopy debris, slight cyan/magenta misregistration on midtones. Risograph red (#ee2a32) and acid yellow (#e8ff2c) on single small surfaces only. Subject central; upper 25% plain newsprint for ransom-note kicker stamp.",
  ),

  // ── Threads card (system default) ──────────────────────────────
  // The new ThreadsCard composition uses the Dossier system by default.
  templateInsert(
    "tpl_threads_dossier", "threads-dossier", "Threads · Dossier Dispatch",
    "threads-photo", "ThreadsCard", 0, "#a8201a",
    '[]',
    "Korean specimen-style backdrop for a Threads still — Dossier register, warm cream paper #f1ead6 with faint blueprint grid, single muted subject in the upper specimen frame (a folded letter, a steam-rising mug at dawn, a brass compass on linen), 50mm soft window light, one crimson stamp accent on a single surface. Leaves room for italic serif headline + body in the lower half. Never bake on-screen text into the image.",
  ),

  // ── Video (Seedance 2.0) — keep ────────────────────────────────
  templateInsert(
    "tpl_seedance_reel", "seedance-reel", "Seedance Reel (Video)",
    "reel-video", "SeedanceReel", 22, "#d8ff00",
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
  // ON CONFLICT(id) DO UPDATE — re-seeding must overwrite existing rows.
  // The prior INSERT OR IGNORE form silently skipped collisions, which
  // meant a re-seed after renaming a slug or repointing a composition
  // left the old row in place. The May 2026 redesign hit this exact
  // bug on `ko-ai-kinetic`: a legacy disabled row blocked the new
  // Kinetic entry. Updated_at = excluded.updated_at so timestamps reflect
  // the latest seed pass.
  return {
    sql: `INSERT INTO templates
      (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
       duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
       bg_mode, default_bg_r2_key, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, 1, 1, ?, ?, 'fade', 'ai', '', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug=excluded.slug,
        name=excluded.name,
        kind=excluded.kind,
        platform=excluded.platform,
        composition_id=excluded.composition_id,
        default_audio_mood=excluded.default_audio_mood,
        duration_sec=excluded.duration_sec,
        enabled=1,
        accent_color=excluded.accent_color,
        bg_prompt_template=excluded.bg_prompt_template,
        updated_at=excluded.updated_at`,
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
