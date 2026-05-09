// Helper that mirrors the statement list from seed.ts and emits inline SQL
// to stdout so wrangler d1 execute --file can run it against remote D1
// without needing a CF API token.
//
// Usage:
//   bun scripts/seed-emit-sql.ts > /tmp/seed.sql
//   bunx wrangler d1 execute loc-app --remote --file=/tmp/seed.sql
//
// Column names + INSERT shape MUST stay in sync with scripts/seed.ts.
//
// Mirrors the May 2026 2026-trend-driven redesign — 5 generic templates
// (Aurora, Gummy, Zine, Kinetic, Dossier) + 5 KR niche presets +
// ThreadsCard + SeedanceReel + NCS audio. Keep `compositionId` strings
// matching the registered ids in src/remotion/Root.tsx exactly.

const now = Date.now();

const STATEMENTS: { sql: string; params: unknown[] }[] = [];

function templateInsert(
  id: string, slug: string, name: string,
  kind: "reel-cards" | "reel-animated" | "reel-video" | "threads-photo",
  compositionId: string, durationSec: number, accentColor: string,
  defaultAudioMood: string, bgPromptTemplate: string,
): void {
  const platform = kind === "threads-photo" ? "threads" : "instagram";
  // ON CONFLICT(id) DO UPDATE — re-seeding must overwrite existing rows.
  // See scripts/seed.ts for the rationale (INSERT OR IGNORE silently
  // skipped legacy collisions like ko-ai-kinetic during the May 2026
  // redesign).
  STATEMENTS.push({
    sql: `INSERT INTO templates
      (id, user_id, slug, name, kind, platform, composition_id, schema, defaults, default_audio_mood,
       duration_sec, version, enabled, accent_color, bg_prompt_template, transition_preset,
       bg_mode, default_bg_r2_key, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, 1, 1, ?, ?, 'fade', 'ai', '', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug=excluded.slug, name=excluded.name, kind=excluded.kind, platform=excluded.platform,
        composition_id=excluded.composition_id, default_audio_mood=excluded.default_audio_mood,
        duration_sec=excluded.duration_sec, enabled=1,
        accent_color=excluded.accent_color, bg_prompt_template=excluded.bg_prompt_template,
        updated_at=excluded.updated_at`,
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

// ── 5 magazine-grade card templates ─────────────────────────────────
templateInsert("tpl_aurora", "aurora-default", "Aurora — Atmospheric Gradient",
  "reel-cards", "Aurora", 22, "#ff6b9d",
  '["chill","ambient","cinematic"]',
  "Atmospheric gradient cinematography — Cool Blue / Drama Club register. Subjects: a single subject silhouetted against deep navy / opal-lilac volumetric haze; a hand or object emerging from cool gradient fog; a horizon line at twilight where indigo bleeds into lilac. Single soft directional light from one named direction (window, dusk sky, fog-scattered overhead). Cool palette dominates (#0a0e2a navy → #6a76d8 → #c8b8ff lilac); one cosmic-pink note (#ff6b9d) on a single small surface only. Subject occupies the central vertical band; upper third stays as plain gradient field for headline overlay.");

templateInsert("tpl_gummy", "gummy-default", "Gummy — Hyperreal 3D Candy",
  "reel-cards", "Gummy", 21, "#ff5b9d",
  '["uplifting","viral","epic"]',
  "Hyperreal-3D tactile photography — Gimme Gummy / Hyperreal-3D-Worlds register. Subjects: a single object photographed flat on a butter-cream seamless backdrop with one hard side light producing a short crisp shadow — a glossy gummy candy, a translucent jelly phone case, a chunky rubber duck, a soft plush keychain on a bubblegum-pink tile. Material reads tactile (glossy-soft, gel-like, rubber). Saturated candy palette: butter cream #fff5d6 backdrop with one bubblegum-pink (#ff5b9d) or electric-lime (#c8ff3c) accent on a single small surface. Subject centered with breathing space; upper 25% plain backdrop for headline tile overlay.");

templateInsert("tpl_zine", "zine-default", "Zine — Counterculture Collage",
  "reel-cards", "Zine", 21, "#ee2a32",
  '["uplifting","viral","cinematic"]',
  "Punk-zine photocopy register — Counterculture-Codes / Pick-and-Mix / Warning-Low-Ink. Subjects: a single subject photographed against #f4f0e6 newsprint paper or scanned from an actual photocopy: a torn ticket stub, a half-faded receipt, a stencilled wall, a tape-marked cardboard, a hand-drawn mark on lined paper. High contrast, visible cyan/magenta misregistration on midtones, faint photocopy debris. Pantone-032c risograph red (#ee2a32) and acid yellow (#e8ff2c) carry the page; black ink dominates negative space. Subject central; upper 25% plain newsprint paper for headline + ransom-note kicker overlay.");

templateInsert("tpl_kinetic", "kinetic-default", "Kinetic — Typographic Maximalism",
  "reel-cards", "Kinetic", 21, "#d8ff00",
  '["epic","viral","cinematic"]',
  "Strict black-field industrial photography — Typographic-Maximalism / Counterculture-Codes register. Subjects: a single hard-lit subject against pure matte black, photographed at oblique angle so the shadow does most of the work — a stainless edge, a server-rack ear bracket, a printed circuit-board trace, a single key-cap, a steel cable end. Deep blacks dominate; subject occupies one tight rectangle of the frame. One acid chartreuse-yellow note (#d8ff00) on a single surface only.");

templateInsert("tpl_dossier", "dossier-default", "Dossier — Micrographics / Blueprint",
  "reel-cards", "Dossier", 22, "#a8201a",
  '["minimal","ambient","cinematic"]',
  "Specimen-sheet documentary photography — Micrographics / Heritage / Hand-Crafted register. Subjects: a single object on warm cream paper #f1ead6 photographed top-down or near-top-down with a faint blueprint-grid printed beneath — a folded letter on a desk, a magnifying-glass beside printed data, a typewriter ribbon, a fountain-pen on linen, a brass compass on architectural drafting paper. Single overcast or single window light, low contrast, paper grain visible. Cream paper + ink-black + a single blueprint-cyan (#2c5e8c) note and one crimson (#a8201a) FILED stamp on a single small surface.");

// ── 5 KR-niche default presets ──────────────────────────────────────
templateInsert("tpl_ko_finance_dossier", "ko-finance-dossier", "투자 · Dossier Brief",
  "reel-cards", "Dossier", 22, "#a8201a",
  '["minimal","ambient","cinematic"]',
  "Korean financial-specimen photography — Dossier register applied to Yeouido / 강남 finance subjects. A single object on warm cream paper with a faint blueprint grid: a printed stock-ticker page with red-pen circles, a folded Bloomberg printout beside a fountain pen, a brass paperweight on cream linen, a typed memo with a 도장 stamp. Single overcast light, low contrast, paper grain visible. Crimson on a single surface; one blueprint-cyan note (a ledger ruling, an ink mark). Subject central, top half clear for italic serif headline + corner registration ticks.");

templateInsert("tpl_ko_ai_kinetic", "ko-ai-kinetic", "AI · Kinetic Frontier",
  "reel-cards", "Kinetic", 21, "#d8ff00",
  '["epic","cinematic","viral"]',
  "Korean tech-press industrial photography — Kinetic register applied to AI/dev tooling. A single subject on matte black or against a plain dark wall: a Korean mechanical keyboard with hangul-engraved keycaps, a stainless-steel laptop hinge edge, an SSD on its side, a single PCB trace, a server-rack ear bracket. One hard side light, deep blacks dominating. The image will become a small inset stamp behind huge type in the layout, so frame the subject tight with empty matte-black around it. One acid chartreuse note on a single small surface.");

templateInsert("tpl_ko_trend_gummy", "ko-trend-gummy", "트렌드 · Gummy Candy",
  "reel-cards", "Gummy", 21, "#ff5b9d",
  '["uplifting","viral","epic"]',
  "Korean MZ-trend tactile photography — Gummy register applied to Korean street/domestic objects. A single subject photographed flat against a butter-cream seamless: a glossy 약과 gummy on a pink tile, a 띠부띠부씰 sticker collection on a butter-cream backdrop, a translucent 추파춥스 jelly, a chunky 새콤달콤 candy bar. Hard side light, faint shadow. One bubblegum-pink or electric-lime note carries the page. Upper 25% plain backdrop for headline-tile overlay.");

templateInsert("tpl_ko_essay_aurora", "ko-essay-aurora", "에세이 · Aurora",
  "reel-cards", "Aurora", 22, "#ff6b9d",
  '["chill","minimal","cinematic"]',
  "Korean essay-magazine atmospheric photography — Aurora register applied to ordinary Korean domestic life under cool gradient light. Subjects: a half-empty mug on a Yeouido windowsill at 7am with the city haze behind, a worn wooden floor with a paperback cracked open, a metal shutter door of a Sangdo-dong side-alley shop at dusk — but always under cool ambient gradient atmosphere (deep navy → opal lilac fog). Single soft directional light. Cool palette dominates; one cosmic-pink note on a single small surface only.");

templateInsert("tpl_ko_quote_zine", "ko-quote-zine", "인용 · Zine Collage",
  "reel-cards", "Zine", 21, "#ee2a32",
  '["chill","cinematic","minimal"]',
  "Korean quote-card photocopy register — Zine applied to contemplative subjects. A single subject on newsprint paper, photographed flat or scanned: a folded letter, a paperback page with a marker line, a tape-marked envelope, a torn poetry magazine spread, a calligraphy 붓 brush on hanji paper. High contrast, faint photocopy debris, slight cyan/magenta misregistration. Risograph red and acid yellow on single small surfaces only. Subject central; upper 25% plain newsprint for ransom-note kicker stamp.");

// ── Threads card ────────────────────────────────────────────────────
templateInsert("tpl_threads_dossier", "threads-dossier", "Threads · Dossier Dispatch",
  "threads-photo", "ThreadsCard", 0, "#a8201a",
  '[]',
  "Korean specimen-style backdrop for a Threads still — Dossier register, warm cream paper #f1ead6 with faint blueprint grid, single muted subject in the upper specimen frame (a folded letter, a steam-rising mug at dawn, a brass compass on linen), 50mm soft window light, one crimson stamp accent on a single surface. Leaves room for italic serif headline + body in the lower half. Never bake on-screen text into the image.");

// ── Video reel ──────────────────────────────────────────────────────
templateInsert("tpl_seedance_reel", "seedance-reel", "Seedance Reel (Video)",
  "reel-video", "SeedanceReel", 22, "#d8ff00",
  '["uplifting","cinematic","epic"]',
  "Cinematic 35mm film feel, soft natural lighting, single clear subject, shallow depth of field, no on-screen text. The first frame is a striking still that the video model can animate naturally — an action half-frozen, not a posed end-frame. Documentary register, never glossy CGI.");

// ── NCS audio ───────────────────────────────────────────────────────
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
