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
