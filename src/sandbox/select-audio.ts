// select-audio.ts — pick a BGM track based on topic prefs + template default mood.
//
// CLI:
//   bun src/sandbox/select-audio.ts \
//     --topic-id <id> \
//     --template-slug <slug> \
//     --duration 18

import { api, toMs, type AudioTrackJson } from "./lib/api";

interface Args {
  topicId: string;
  templateSlug?: string;
  duration: number;
}

function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) m.set(argv[i]!.slice(2), argv[++i] ?? "");
  }
  return {
    topicId: m.get("topic-id") ?? "",
    templateSlug: m.get("template-slug"),
    duration: Number(m.get("duration") ?? "18"),
  };
}

async function main(args: Args): Promise<void> {
  if (!args.topicId) throw new Error("--topic-id required");

  const [{ topic }, { tracks }, tpl] = await Promise.all([
    api.getTopic(args.topicId),
    api.listAudio(),
    args.templateSlug ? api.getTemplate(args.templateSlug) : Promise.resolve({ template: null }),
  ]);

  const topicTyped = topic as {
    audioPrefs?: { moodTags?: string[]; allowedSources?: string[]; fixedTrackId?: string };
  } | null;
  const audioPrefs = topicTyped?.audioPrefs ?? {};
  const templateMood = tpl.template?.defaultAudioMood ?? [];

  const enabled = tracks.filter((t) => t.enabled);

  if (audioPrefs.fixedTrackId) {
    const t = enabled.find((x) => x.id === audioPrefs.fixedTrackId);
    if (t) return emit(t);
  }

  const allowed = audioPrefs.allowedSources && audioPrefs.allowedSources.length > 0
    ? audioPrefs.allowedSources
    : ["ncs", "upload", "suno"];

  const wantedMoods = new Set([...(audioPrefs.moodTags ?? []), ...templateMood].map((s) => s.toLowerCase()));
  const minDuration = args.duration + 2;

  const candidates = enabled
    .filter((t) => allowed.includes(t.source))
    .filter((t) => t.durationSec >= minDuration);

  const scored = candidates.map((t) => {
    const moodMatch = wantedMoods.size > 0
      ? t.moodTags.filter((m) => wantedMoods.has(m.toLowerCase())).length
      : 1;
    const lastMs = toMs(t.lastUsedAt);
    const recencyPenalty = lastMs
      ? Math.max(0, 7 - (Date.now() - lastMs) / (1000 * 60 * 60 * 24))
      : 0;
    return { track: t, score: moodMatch * 10 - recencyPenalty + Math.random() };
  }).sort((a, b) => b.score - a.score);

  // Walk candidates in score order; skip rows whose R2 object is missing.
  // The audio_tracks catalog can drift from R2 (e.g. seeded placeholder
  // rows whose mp3 was never uploaded) — Remotion hard-fails the render
  // if the audioUrl 404s, so verify before committing to a pick.
  const ordered = scored.map((s) => s.track);
  const r2Base = process.env.R2_PUBLIC_BASE ?? "";
  for (const t of ordered) {
    if (r2Base && !(await r2ObjectExists(`${r2Base}/${t.r2Key}`))) {
      console.error(`[select-audio] skip ${t.id} (${t.r2Key}): R2 object missing`);
      continue;
    }
    await api.touchAudio(t.id);
    emit(t);
    return;
  }
  throw new Error("no audio tracks available (all candidates missing in R2)");
}

async function r2ObjectExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function emit(t: AudioTrackJson): void {
  console.log(JSON.stringify({
    id: t.id,
    name: t.name,
    artist: t.artist,
    source: t.source,
    r2Key: t.r2Key,
    durationSec: t.durationSec,
    attributionText: t.attributionText,
  }));
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
