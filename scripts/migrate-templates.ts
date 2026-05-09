export {};

// One-shot migration: after seeding the new magazine-grade templates,
// disable the old (pre-2026-05) templates and reassign each topic's
// templateSlugs[] to the closest new equivalent based on its persona +
// description text.
//
// Two execution modes (auto-detected):
//   - API mode  — when CLOUDFLARE_ACCOUNT_ID + D1_DATABASE_ID +
//                 CLOUDFLARE_API_TOKEN are all set, talks to the D1
//                 HTTP API directly (faster, fewer subprocesses).
//   - wrangler  — otherwise, shells out to `bunx wrangler d1 execute
//                 loc-app --remote --json` and uses whatever auth
//                 wrangler is logged into (OAuth or API token).
//
// Idempotent — re-running on already-migrated topics is a no-op.

import { spawnSync } from "node:child_process";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const useApi = !!(accountId && databaseId && token);
const url = useApi
  ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  : "";
const D1_BINDING_NAME = process.env.D1_BINDING ?? "loc-app";

console.log(useApi ? "→ D1 API mode" : `→ wrangler subprocess mode (db=${D1_BINDING_NAME})`);

// New curated slugs (must match scripts/seed.ts).
const NEW_SLUGS = new Set([
  "aurora-default", "gummy-default", "zine-default", "kinetic-default", "dossier-default",
  "ko-finance-dossier", "ko-ai-kinetic", "ko-trend-gummy", "ko-essay-aurora", "ko-quote-zine",
  "threads-dossier", "seedance-reel",
]);

// Old slugs to disable. Anything in the templates table whose user_id IS
// NULL and whose slug is NOT in NEW_SLUGS gets enabled=0.
const OLD_SLUG_HINT = [
  // Pre-2026 redesign slugs (Editorial / Monocle / Riso / Cover / Index032c).
  "editorial-default", "monocle-brief", "riso-poster", "cover-feature", "index-frontier",
  "ko-finance-monocle", "ko-ai-index", "ko-trend-riso", "ko-essay-editorial", "ko-quote-cover",
  "threads-editorial",
  // Even older legacy slugs from before the magazine-grade redesign.
  "card-news-default", "threads-card-default",
  "kinetic-type", "bold-editorial", "minimal-grid", "neo-brutalism",
  "glass-morphism", "retro-vhs", "data-story", "quote-spotlight",
  "ko-finance-data", "ko-finance-minimal", "ko-finance-quote",
  "ko-ai-glass",
  "ko-news-brutal", "ko-trend-card",
  "ko-threads-news",
  "ko-listicle-top5", "ko-hot-take", "ko-before-after", "ko-authority-quote",
];

// Persona-driven topic remap. We match on the topic's name + description
// + persona_prompt text and pick the most-specific matching new slug.
// Order matters — first match wins.
const REMAP_RULES: { pattern: RegExp; newSlug: string }[] = [
  {
    pattern: /(투자|금융|증권|주식|코스피|코스닥|환율|채권|연준|fed|재테크|finance|stock|trading|inflation|인플레이션|부동산)/i,
    newSlug: "ko-finance-dossier",
  },
  {
    pattern: /(ai|인공지능|gpt|claude|모델|llm|prompt|프롬프트|cursor|개발자|coding|코딩|engineering|엔지니어|tech|frontier)/i,
    newSlug: "ko-ai-kinetic",
  },
  {
    pattern: /(인용|quote|어록|명상|meditation|reflection|aphorism|essay\s*quote|책)/i,
    newSlug: "ko-quote-zine",
  },
  {
    pattern: /(에세이|essay|일기|개인적|opinion|오피니언|회고|reflective)/i,
    newSlug: "ko-essay-aurora",
  },
  {
    pattern: /(트렌드|trend|mz|z세대|뉴스|news|breaking|속보|핫한|화제|밈|meme|viral)/i,
    newSlug: "ko-trend-gummy",
  },
];

const DEFAULT_NEW_SLUG = "aurora-default";

interface TopicRow {
  id: string;
  name: string;
  description: string | null;
  persona_prompt: string;
  template_slugs: string;
}

async function exec(sql: string, params: unknown[] = []): Promise<{ result: Array<{ results: unknown[] }> }> {
  if (useApi) {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`D1 ${res.status}: ${body.slice(0, 400)}`);
    }
    return res.json() as Promise<{ result: Array<{ results: unknown[] }> }>;
  }
  // Wrangler subprocess mode — substitute params client-side, run via CLI.
  // Wrangler doesn't accept positional params with `--command`, so we
  // inline-quote them. Safe for our internal-only use of strings/numbers.
  const inlined = inlineParams(sql, params);
  const r = spawnSync("bunx", ["wrangler", "d1", "execute", D1_BINDING_NAME, "--remote", "--json", "--command", inlined], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });
  if (r.status !== 0) {
    throw new Error(`wrangler d1 execute exit=${r.status}: ${r.stderr.slice(0, 600)}`);
  }
  const out = r.stdout.trim();
  // wrangler returns an array of result objects per statement; we run one.
  let parsed: Array<{ results?: unknown[]; meta?: { changes?: number } }>;
  try { parsed = JSON.parse(out) as Array<{ results?: unknown[]; meta?: { changes?: number } }>; }
  catch { throw new Error(`wrangler d1 returned non-JSON: ${out.slice(0, 400)}`); }
  const first = parsed[0] ?? { results: [] };
  return { result: [{ results: first.results ?? [] }] };
}

function inlineParams(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

async function main() {
  // 1) Disable old shared templates
  const placeholders = OLD_SLUG_HINT.map(() => "?").join(",");
  const dis = await exec(
    `UPDATE templates SET enabled = 0, updated_at = ?
     WHERE user_id IS NULL AND slug IN (${placeholders})`,
    [Date.now(), ...OLD_SLUG_HINT],
  );
  console.log(`✓ disabled old shared templates (rows touched: ${(dis.result as unknown as { meta?: { changes?: number } })?.meta?.changes ?? "?"})`);

  // 2) Read every topic
  const r = await exec(
    `SELECT id, name, description, persona_prompt, template_slugs FROM topics`,
  );
  const rows = ((r.result?.[0]?.results as unknown) ?? []) as TopicRow[];
  console.log(`→ ${rows.length} topics to inspect`);

  // 3) For each topic, decide if reassignment is needed and what to.
  let touched = 0, skipped = 0;
  for (const row of rows) {
    let slugs: string[] = [];
    try { slugs = JSON.parse(row.template_slugs) as string[]; } catch { slugs = []; }
    const current = (slugs[0] ?? "").trim();

    // Already on a new slug? Nothing to do.
    if (NEW_SLUGS.has(current)) { skipped++; continue; }

    const corpus = `${row.name} ${row.description ?? ""} ${row.persona_prompt ?? ""}`.toLowerCase();
    const match = REMAP_RULES.find((r) => r.pattern.test(corpus));
    const newSlug = match?.newSlug ?? DEFAULT_NEW_SLUG;

    await exec(
      `UPDATE topics SET template_slugs = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify([newSlug]), Date.now(), row.id],
    );
    console.log(`  ✓ ${row.name}: ${current || "(none)"} → ${newSlug}`);
    touched++;
  }

  console.log(`\nDone. reassigned=${touched} skipped=${skipped} total=${rows.length}`);
}

await main().catch((e) => { console.error(e); process.exit(1); });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} env var is required`);
    process.exit(1);
  }
  return v;
}
