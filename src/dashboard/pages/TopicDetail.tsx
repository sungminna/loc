import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import cronstrue from "cronstrue";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

const TABS = ["overview", "storyboard", "runs", "prompts", "posts"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  overview: "개요",
  storyboard: "스토리보드",
  runs: "실행 이력",
  prompts: "프롬프트",
  posts: "게시 이력",
};

export function TopicDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <TopicDetailInner id={id} />;
}

function TopicDetailInner({ id }: { id: string }) {
  const detail = trpc.topics.get.useQuery({ id });
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const toast = useToast();

  const runNow = trpc.topics.runNow.useMutation({
    onSuccess: ({ runId }) => { toast({ tone: "ok", msg: `실행 큐에 추가됨 (${runId.slice(0, 8)}…)` }); utils.topics.get.invalidate({ id }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.topics.remove.useMutation({
    onSuccess: () => { utils.topics.list.invalidate(); navigate("/topics"); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [tab, setTab] = useState<Tab>("overview");

  if (detail.isLoading) return <Skeleton rows={4} height="h-32" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  if (!detail.data) return null;

  const { topic, runs, posts, notes, assets, lastBrief, publicMediaBase } = detail.data;
  const lastRun = runs[0];

  return (
    <div className="space-y-6">
      <header>
        <Link to="/topics" className="text-zinc-500 text-sm hover:text-zinc-300">← Topics</Link>
        <div className="flex items-end justify-between mt-2 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${topic.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
              <h1 className="text-3xl font-bold tracking-tight truncate">{topic.name}</h1>
              <span className="text-zinc-500 text-xs uppercase tracking-wider">{topic.lang}</span>
            </div>
            <div className="text-zinc-400 mt-1 text-sm">
              {safeCron(topic.cron)} · 일일 {topic.dailyRunCap}회 · ${topic.costCapUsd} 상한
              {lastRun ? <> · 최근 실행 <RunPill status={lastRun.status} /></> : null}
            </div>
            {topic.description ? <div className="text-zinc-500 text-sm mt-1">{topic.description}</div> : null}
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn btn-primary" onClick={() => runNow.mutate({ id })} disabled={runNow.isPending}>
              {runNow.isPending ? "전송 중..." : "지금 실행"}
            </button>
            <button className="btn btn-danger" onClick={() => {
              if (confirm(`"${topic.name}" 토픽을 삭제할까요? 관련 실행 이력도 모두 삭제됩니다.`)) remove.mutate({ id });
            }}>삭제</button>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 transition ${tab === t ? "border-yellow-300 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab topic={topic} onSaved={() => utils.topics.get.invalidate({ id })} />}
      {tab === "storyboard" && (
        <StoryboardTab
          topic={topic}
          lastBrief={lastBrief}
          assets={assets}
          publicMediaBase={publicMediaBase}
          onSaved={() => utils.topics.get.invalidate({ id })}
        />
      )}
      {tab === "runs" && <RunsTab runs={runs} notes={notes} />}
      {tab === "prompts" && <PromptsTab />}
      {tab === "posts" && <PostsTab posts={posts} />}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────

interface TopicLite {
  id: string;
  name: string;
  description: string | null;
  lang: "ko" | "en" | "ko+en";
  personaPrompt: string;
  imageStylePrompt: string;
  sourceUrls: string[];
  targetAccounts: { instagram?: string; threads?: string };
  templateSlugs: string[];
  audioPrefs: { moodTags?: string[]; allowedSources?: ("ncs" | "upload" | "suno")[]; fixedTrackId?: string };
  cron: string;
  dailyRunCap: number;
  costCapUsd: number;
  enabled: boolean;
  draftBrief: unknown;
  useDraftForNext: boolean;
}

function OverviewTab({ topic, onSaved }: { topic: TopicLite; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const accounts = trpc.accounts.list.useQuery();
  const templates = trpc.templates.list.useQuery();

  const update = trpc.topics.update.useMutation({
    onSuccess: () => { utils.topics.get.invalidate({ id: topic.id }); utils.topics.list.invalidate(); onSaved(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [form, setForm] = useState({
    name: topic.name,
    description: topic.description ?? "",
    lang: topic.lang,
    personaPrompt: topic.personaPrompt,
    imageStylePrompt: topic.imageStylePrompt,
    sourceUrls: topic.sourceUrls,
    targetAccounts: topic.targetAccounts,
    templateSlugs: topic.templateSlugs,
    audioPrefs: topic.audioPrefs,
    cron: topic.cron,
    dailyRunCap: topic.dailyRunCap,
    costCapUsd: topic.costCapUsd,
    enabled: topic.enabled,
  });

  return (
    <section className="space-y-4">
      <Field label="이름">
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="설명" hint="대시보드에서만 보이는 메모">
        <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="언어">
          <select className="input" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as TopicLite["lang"] })}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ko+en">한국어 + English</option>
          </select>
        </Field>
        <Field label="cron" error={cronError(form.cron)} hint={cronError(form.cron) ? undefined : safeCron(form.cron)}>
          <input className="input font-mono text-xs" value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} />
        </Field>
      </div>

      <Field label="페르소나 프롬프트" hint="브랜드 톤·시점. content-plan 스킬이 카피 톤을 잡을 때 참고합니다.">
        <textarea className="input min-h-24" value={form.personaPrompt} onChange={(e) => setForm({ ...form, personaPrompt: e.target.value })} />
      </Field>

      <Field label="이미지 스타일 프롬프트" hint="모든 슬라이드 배경 생성 프롬프트 앞에 붙습니다. 브랜드 시각 스타일 고정용.">
        <textarea className="input min-h-20 font-mono text-xs"
          value={form.imageStylePrompt}
          onChange={(e) => setForm({ ...form, imageStylePrompt: e.target.value })}
          placeholder="Editorial photography, soft natural light, 50mm, shallow depth of field, muted earth tones"
        />
      </Field>

      <Field label="소스 URL" hint="한 줄에 하나. 비워두면 WebSearch로 트렌드 발굴.">
        <textarea className="input min-h-20 font-mono text-xs" value={form.sourceUrls.join("\n")}
          onChange={(e) => setForm({ ...form, sourceUrls: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Instagram 계정">
          <select className="input" value={form.targetAccounts.instagram ?? ""}
            onChange={(e) => setForm({ ...form, targetAccounts: { ...form.targetAccounts, instagram: e.target.value || undefined } })}>
            <option value="">— 미사용 —</option>
            {(accounts.data ?? []).filter((a) => a.platform === "instagram").map((a) => <option key={a.id} value={a.id}>@{a.handle}</option>)}
          </select>
        </Field>
        <Field label="Threads 계정">
          <select className="input" value={form.targetAccounts.threads ?? ""}
            onChange={(e) => setForm({ ...form, targetAccounts: { ...form.targetAccounts, threads: e.target.value || undefined } })}>
            <option value="">— 미사용 —</option>
            {(accounts.data ?? []).filter((a) => a.platform === "threads").map((a) => <option key={a.id} value={a.id}>@{a.handle}</option>)}
          </select>
        </Field>
      </div>

      <Field label="템플릿">
        <select className="input" value={form.templateSlugs[0] ?? ""}
          onChange={(e) => setForm({ ...form, templateSlugs: e.target.value ? [e.target.value] : [] })}>
          <option value="">— 기본 —</option>
          {(templates.data ?? []).map((t) => <option key={t.id} value={t.slug}>{t.name} ({t.slug})</option>)}
        </select>
      </Field>

      <Field label="음원 mood" hint="콤마 구분. 예: uplifting, minimal">
        <input className="input" value={(form.audioPrefs.moodTags ?? []).join(", ")}
          onChange={(e) => setForm({ ...form, audioPrefs: { ...form.audioPrefs, moodTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="일일 실행 상한">
          <input className="input" type="number" min={1} max={20} value={form.dailyRunCap}
            onChange={(e) => setForm({ ...form, dailyRunCap: Math.max(1, Number(e.target.value)) })} />
        </Field>
        <Field label="회당 비용 상한 (USD)">
          <input className="input" type="number" min={1} max={100} value={form.costCapUsd}
            onChange={(e) => setForm({ ...form, costCapUsd: Math.max(1, Number(e.target.value)) })} />
        </Field>
        <Field label="활성화">
          <label className="input flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            <span>{form.enabled ? "ON" : "OFF"}</span>
          </label>
        </Field>
      </div>

      <button className="btn btn-primary" disabled={update.isPending} onClick={() => update.mutate({ id: topic.id, ...form })}>
        {update.isPending ? "저장 중..." : "저장"}
      </button>
    </section>
  );
}

// ─── Storyboard tab ───────────────────────────────────────────────────

interface SlideDraft {
  kicker?: string;
  headline?: string;
  body?: string;
  emphasis?: string;
  bgImageUrl?: string;
  bgImageR2Key?: string;
  bgImagePrompt?: string;
}

interface DraftBrief {
  topic?: { headline?: string; angle?: string };
  slides?: SlideDraft[];
  threads?: { text?: string; bgImageUrl?: string; bgImageR2Key?: string; bgImagePrompt?: string };
  caption?: { instagram?: string; threads?: string };
  hashtags?: string[];
}

interface TopicAssetRow {
  id: string;
  topicId: string;
  kind: "bg-slide" | "bg-threads" | "asset";
  r2Key: string;
  prompt: string;
  slideIndex: number | null;
  createdAt: Date;
}

function StoryboardTab({
  topic, lastBrief, assets, publicMediaBase, onSaved,
}: {
  topic: TopicLite;
  lastBrief: unknown;
  assets: TopicAssetRow[];
  publicMediaBase: string;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const toast = useToast();

  const saveDraft = trpc.topics.saveDraft.useMutation({
    onSuccess: () => { utils.topics.get.invalidate({ id: topic.id }); onSaved(); toast({ tone: "ok", msg: "초안 저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const clearDraft = trpc.topics.clearDraft.useMutation({
    onSuccess: () => {
      // Local state mirror the server: drop everything to defaults so the
      // user doesn't see "ghost" slides from the just-deleted draft.
      setDraft({ slides: defaultSlides() });
      utils.topics.get.invalidate({ id: topic.id });
      onSaved();
      toast({ tone: "ok", msg: "초안 삭제됨" });
    },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const setUseDraft = trpc.topics.setUseDraft.useMutation({
    onSuccess: () => { utils.topics.get.invalidate({ id: topic.id }); onSaved(); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const genImage = trpc.topics.genImage.useMutation({
    onSuccess: () => { utils.topics.get.invalidate({ id: topic.id }); onSaved(); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const deleteAsset = trpc.topics.deleteAsset.useMutation({
    onSuccess: () => { utils.topics.get.invalidate({ id: topic.id }); onSaved(); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const initial: DraftBrief = useMemo(() => {
    if (topic.draftBrief && typeof topic.draftBrief === "object") return topic.draftBrief as DraftBrief;
    if (lastBrief && typeof lastBrief === "object") return briefShape(lastBrief);
    return { slides: defaultSlides() };
  }, [topic.id]);

  const [draft, setDraft] = useState<DraftBrief>(initial);
  const [genIdx, setGenIdx] = useState<number | null>(null);

  function setSlide(i: number, patch: Partial<SlideDraft>) {
    const slides = [...(draft.slides ?? [])];
    const cur = slides[i] ?? {};
    slides[i] = { ...cur, ...patch };
    setDraft({ ...draft, slides });
  }
  function addSlide() {
    const slides = [...(draft.slides ?? []), { headline: "" }];
    setDraft({ ...draft, slides });
  }
  function removeSlide(i: number) {
    const slides = [...(draft.slides ?? [])];
    slides.splice(i, 1);
    setDraft({ ...draft, slides });
  }
  function moveSlide(i: number, dir: -1 | 1) {
    const slides = [...(draft.slides ?? [])];
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const a = slides[i]!;
    const b = slides[j]!;
    slides[i] = b;
    slides[j] = a;
    setDraft({ ...draft, slides });
  }

  async function regenSlideImage(i: number) {
    const slide = draft.slides?.[i];
    const prompt = (slide?.bgImagePrompt ?? "").trim();
    if (!prompt) {
      toast({ tone: "err", msg: "슬라이드 이미지 프롬프트를 입력하세요." });
      return;
    }
    setGenIdx(i);
    try {
      const res = await genImage.mutateAsync({
        topicId: topic.id,
        prompt,
        kind: "bg-slide",
        slideIndex: i,
        aspect: "2:3",
        quality: "high",
      });
      setSlide(i, { bgImageUrl: res.url, bgImageR2Key: res.r2Key });
      toast({ tone: "ok", msg: `슬라이드 ${i + 1} 배경 생성됨` });
    } finally {
      setGenIdx(null);
    }
  }

  async function regenThreadsImage() {
    const prompt = (draft.threads?.bgImagePrompt ?? "").trim();
    if (!prompt) {
      toast({ tone: "err", msg: "Threads 이미지 프롬프트를 입력하세요." });
      return;
    }
    setGenIdx(-1);
    try {
      const res = await genImage.mutateAsync({
        topicId: topic.id,
        prompt,
        kind: "bg-threads",
        aspect: "2:3",
        quality: "high",
      });
      setDraft({
        ...draft,
        threads: { ...(draft.threads ?? {}), bgImageUrl: res.url, bgImageR2Key: res.r2Key },
      });
      toast({ tone: "ok", msg: "Threads 배경 생성됨" });
    } finally {
      setGenIdx(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium">초안 ({draft.slides?.length ?? 0} 슬라이드)</div>
          <div className="text-xs text-zinc-500 mt-1">
            저장하면 D1에 영구 보존되고 재배포 후에도 유지됩니다. “다음 실행에 사용” ON이면 orchestrate-run 스킬이 이 brief를 그대로 사용합니다.
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={topic.useDraftForNext}
              onChange={(e) => setUseDraft.mutate({ id: topic.id, value: e.target.checked })} />
            <span>다음 실행에 사용</span>
          </label>
          <button className="btn btn-ghost" onClick={() => clearDraft.mutate({ id: topic.id })}
            disabled={clearDraft.isPending}>초안 삭제</button>
          <button className="btn btn-primary" onClick={() => saveDraft.mutate({ id: topic.id, brief: draft })}
            disabled={saveDraft.isPending}>{saveDraft.isPending ? "저장 중..." : "초안 저장"}</button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">토픽 헤더</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Headline">
            <input className="input" value={draft.topic?.headline ?? ""}
              onChange={(e) => setDraft({ ...draft, topic: { ...draft.topic, headline: e.target.value } })} />
          </Field>
          <Field label="Angle">
            <input className="input" value={draft.topic?.angle ?? ""}
              onChange={(e) => setDraft({ ...draft, topic: { ...draft.topic, angle: e.target.value } })} />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        {(draft.slides ?? []).map((slide, i) => (
          <div key={i} className="card grid grid-cols-[160px_1fr] gap-4">
            <SlideThumb url={slide.bgImageUrl} loading={genIdx === i} accent="#facc15" index={i} total={draft.slides?.length ?? 1} />
            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-zinc-500">slide #{i + 1}</div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost text-xs" onClick={() => moveSlide(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-ghost text-xs" onClick={() => moveSlide(i, 1)} disabled={i === (draft.slides?.length ?? 0) - 1}>↓</button>
                  <button className="btn btn-danger text-xs" onClick={() => removeSlide(i)}>삭제</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Kicker">
                  <input className="input text-sm" value={slide.kicker ?? ""}
                    onChange={(e) => setSlide(i, { kicker: e.target.value })} />
                </Field>
                <Field label="Emphasis">
                  <input className="input text-sm" value={slide.emphasis ?? ""}
                    onChange={(e) => setSlide(i, { emphasis: e.target.value })} placeholder="🔖" />
                </Field>
                <Field label="bg R2 key" hint="자동으로 채워짐">
                  <input className="input text-xs font-mono" value={slide.bgImageR2Key ?? ""}
                    onChange={(e) => setSlide(i, { bgImageR2Key: e.target.value })} />
                </Field>
              </div>
              <Field label="Headline">
                <input className="input" value={slide.headline ?? ""}
                  onChange={(e) => setSlide(i, { headline: e.target.value })} />
              </Field>
              <Field label="Body">
                <textarea className="input min-h-20" value={slide.body ?? ""}
                  onChange={(e) => setSlide(i, { body: e.target.value })} />
              </Field>
              <div className="border-t border-zinc-800 pt-3">
                <Field label="배경 이미지 프롬프트" hint="topic.imageStylePrompt 가 자동으로 앞에 붙습니다.">
                  <textarea className="input min-h-16 font-mono text-xs" value={slide.bgImagePrompt ?? ""}
                    onChange={(e) => setSlide(i, { bgImagePrompt: e.target.value })}
                    placeholder="bold composition, single focal subject, high contrast..." />
                </Field>
                <div className="flex justify-end mt-2 gap-2">
                  {slide.bgImageR2Key ? (
                    <button className="btn btn-ghost text-xs" onClick={() => setSlide(i, { bgImageR2Key: undefined, bgImageUrl: undefined })}>
                      이미지 제거
                    </button>
                  ) : null}
                  <button className="btn btn-primary text-xs" onClick={() => regenSlideImage(i)} disabled={genIdx !== null}>
                    {genIdx === i ? "생성 중... (~30s)" : "이미지 생성/재생성"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost w-full border border-dashed border-zinc-700 py-3" onClick={addSlide}>+ 슬라이드 추가</button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Threads 카드</h3>
        <div className="grid grid-cols-[160px_1fr] gap-4">
          <SlideThumb url={draft.threads?.bgImageUrl} loading={genIdx === -1} accent="#facc15" index={0} total={1} aspect="aspect-[4/5]" />
          <div className="space-y-3">
            <Field label="Text">
              <textarea className="input min-h-20" value={draft.threads?.text ?? ""}
                onChange={(e) => setDraft({ ...draft, threads: { ...(draft.threads ?? {}), text: e.target.value } })} />
            </Field>
            <Field label="배경 이미지 프롬프트">
              <textarea className="input min-h-16 font-mono text-xs"
                value={draft.threads?.bgImagePrompt ?? ""}
                onChange={(e) => setDraft({ ...draft, threads: { ...(draft.threads ?? {}), bgImagePrompt: e.target.value } })} />
            </Field>
            <div className="flex justify-end">
              <button className="btn btn-primary text-xs" onClick={regenThreadsImage} disabled={genIdx !== null}>
                {genIdx === -1 ? "생성 중..." : "이미지 생성/재생성"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">캡션 / 해시태그</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Instagram caption">
            <textarea className="input min-h-24" value={draft.caption?.instagram ?? ""}
              onChange={(e) => setDraft({ ...draft, caption: { ...draft.caption, instagram: e.target.value } })} />
          </Field>
          <Field label="Threads text">
            <textarea className="input min-h-24" value={draft.caption?.threads ?? ""}
              onChange={(e) => setDraft({ ...draft, caption: { ...draft.caption, threads: e.target.value } })} />
          </Field>
        </div>
        <Field label="Hashtags" hint="콤마 또는 공백 구분 (#는 자동 제거)">
          <input className="input" value={(draft.hashtags ?? []).join(" ")}
            onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/[\s,]+/).map((s) => s.replace(/^#/, "")).filter(Boolean) })} />
        </Field>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">생성된 이미지 라이브러리 ({assets.length})</h3>
        {assets.length === 0 ? (
          <div className="text-sm text-zinc-500">아직 이 토픽으로 만든 이미지가 없습니다. 위에서 슬라이드 이미지를 생성해보세요.</div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {assets.map((a) => (
              <div key={a.id} className="border border-zinc-800 rounded-lg overflow-hidden">
                <img src={`${publicMediaBase}/${a.r2Key}`} className="w-full aspect-[2/3] object-cover" alt="" />
                <div className="p-2 text-xs">
                  <div className="text-zinc-400 line-clamp-2 break-words">{a.prompt}</div>
                  <div className="flex justify-between mt-1 text-zinc-600">
                    <span>{a.kind}{a.slideIndex != null ? ` · #${a.slideIndex + 1}` : ""}</span>
                    <button className="text-red-300 hover:text-red-200"
                      onClick={() => deleteAsset.mutate({ id: a.id })}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SlideThumb({ url, loading, accent, index, total, aspect = "aspect-[2/3]" }: {
  url?: string; loading: boolean; accent: string; index: number; total: number; aspect?: string;
}) {
  return (
    <div
      className={`relative ${aspect} rounded-xl overflow-hidden border border-zinc-800`}
      style={{ background: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)" }}
    >
      {url ? <img src={url} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" /> : null}
      <div className="absolute top-2 left-2 right-2 flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20">
            <div className="h-full" style={{ width: i < index ? "100%" : i === index ? "60%" : "0%", background: accent }} />
          </div>
        ))}
      </div>
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs bg-black/60 backdrop-blur-sm text-yellow-300 animate-pulse">생성 중...</div>
      ) : null}
      <div className="absolute bottom-1.5 left-1.5 text-[9px] tracking-widest text-zinc-300/80">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
    </div>
  );
}

function defaultSlides(): SlideDraft[] {
  return [
    { kicker: "TREND", headline: "오늘의 키워드", body: "지금 가장 뜨거운 주제 한 줄 요약." },
    { headline: "Why it matters", body: "왜 이 트렌드를 알아야 하는지." },
    { headline: "The shift", body: "변하는 것 vs 그대로인 것." },
    { headline: "Action", body: "이번 주에 시도해볼 것 3가지." },
    { headline: "Save this", body: "다음에 써먹을 수 있게 저장.", emphasis: "🔖" },
  ];
}

function briefShape(brief: unknown): DraftBrief {
  if (!brief || typeof brief !== "object") return { slides: defaultSlides() };
  const b = brief as DraftBrief & Record<string, unknown>;
  return {
    topic: b.topic,
    slides: Array.isArray(b.slides) ? b.slides : defaultSlides(),
    threads: b.threads,
    caption: b.caption,
    hashtags: b.hashtags,
  };
}

// ─── Runs tab ─────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  status: string;
  costUsdMicros: number;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

interface NoteRow {
  id: string;
  sourceUrl: string;
  title: string | null;
  summary: string | null;
  createdAt: Date;
}

function RunsTab({ runs, notes }: { runs: RunRow[]; notes: NoteRow[] }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-3">최근 실행 ({runs.length})</h2>
        {runs.length === 0 ? (
          <div className="text-sm text-zinc-500">아직 실행 이력이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="card flex items-center justify-between text-sm">
                <div className="flex gap-3 items-center min-w-0">
                  <RunPill status={r.status} />
                  <code className="text-xs text-zinc-500">{r.id.slice(0, 10)}</code>
                  {r.error ? <span className="text-xs text-red-400 truncate max-w-md">{r.error}</span> : null}
                </div>
                <div className="text-zinc-500 text-xs shrink-0 ml-3">
                  ${(r.costUsdMicros / 1_000_000).toFixed(3)} · {r.tokensIn + r.tokensOut} tok · {r.createdAt.toLocaleString("ko-KR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">리서치 노트 ({notes.length})</h2>
        {notes.length === 0 ? (
          <div className="text-sm text-zinc-500">아직 리서치 노트가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="card text-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{n.title ?? "(제목 없음)"}</div>
                    <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-yellow-300 truncate block max-w-xl">{n.sourceUrl}</a>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0">{n.createdAt.toLocaleString("ko-KR")}</span>
                </div>
                {n.summary ? <div className="text-zinc-400 mt-2 whitespace-pre-line">{n.summary}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Prompts tab ──────────────────────────────────────────────────────

function PromptsTab() {
  const list = trpc.skillPrompts.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const upsert = trpc.skillPrompts.upsert.useMutation({
    onSuccess: () => { utils.skillPrompts.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.skillPrompts.remove.useMutation({
    onSuccess: () => { utils.skillPrompts.list.invalidate(); toast({ tone: "ok", msg: "삭제됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  if (list.isLoading) return <Skeleton rows={4} height="h-16" />;
  if (list.error) return <ErrorBox error={list.error} onRetry={() => list.refetch()} />;

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-400 max-w-2xl">
        각 스킬(<code>.claude/skills/&lt;name&gt;/SKILL.md</code>)에 추가될 사용자 지시문입니다. 스킬 본문 끝에 <code>USER OVERRIDE</code> 섹션으로 합쳐져 sandbox에서 Claude Code CLI가 읽습니다. 비워두거나 “비활성화”하면 무시됩니다. D1에 저장되어 재배포 후에도 유지됩니다.
      </div>
      {list.data?.map((row) => <SkillPromptRow key={row.skillName} row={row} onSave={upsert.mutate} onRemove={remove.mutate} />)}
    </div>
  );
}

type SkillNameLiteral =
  | "topic-research" | "content-plan" | "image-gen" | "select-audio"
  | "render-reel" | "render-threads-image" | "ig-publish-reel"
  | "threads-publish" | "orchestrate-run";

interface SkillRow {
  skillName: SkillNameLiteral;
  override: string;
  enabled: boolean;
  hasOverride: boolean;
}

function SkillPromptRow({ row, onSave, onRemove }: {
  row: SkillRow;
  onSave: (input: { skillName: SkillNameLiteral; override: string; enabled: boolean }) => void;
  onRemove: (input: { skillName: SkillNameLiteral }) => void;
}) {
  const [text, setText] = useState(row.override);
  const [enabled, setEnabled] = useState(row.enabled);
  const dirty = text !== row.override || enabled !== row.enabled;

  return (
    <details className="card" open={row.hasOverride}>
      <summary className="cursor-pointer flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="text-zinc-200">{row.skillName}</code>
          {row.hasOverride ? (
            <span className={`text-xs px-1.5 py-0.5 rounded ${row.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>
              {row.enabled ? "ACTIVE" : "DISABLED"}
            </span>
          ) : <span className="text-xs text-zinc-500">기본 사용 중</span>}
        </div>
        {row.hasOverride ? (
          <span className="text-xs text-zinc-500" onClick={(e) => { e.preventDefault(); onRemove({ skillName: row.skillName }); }}>
            <button className="text-red-300 hover:text-red-200">제거</button>
          </span>
        ) : null}
      </summary>
      <div className="mt-3 space-y-2">
        <textarea className="input min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={`예) topic-research 에서는 source_urls 외에 X(트위터)에서 한국어 키워드 ${row.skillName === "topic-research" ? "검색을 추가로 수행" : "..."}`} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>활성화</span>
          </label>
          <button className="btn btn-primary" disabled={!dirty}
            onClick={() => onSave({ skillName: row.skillName, override: text, enabled })}>
            저장
          </button>
        </div>
      </div>
    </details>
  );
}

// ─── Posts tab ────────────────────────────────────────────────────────

interface PostRow {
  id: string;
  platform: "instagram" | "threads";
  status: "pending" | "published" | "failed";
  caption: string;
  publishedAt: Date | null;
  permalink: string | null;
  errorMessage: string | null;
}

function PostsTab({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return <div className="card text-zinc-500 text-sm">아직 게시 이력이 없습니다.</div>;
  }
  return (
    <div className="space-y-2">
      {posts.map((p) => (
        <article key={p.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className={`px-2 py-0.5 rounded text-xs ${badgePost(p.status)}`}>{p.status}</span>
                <span className="text-xs text-zinc-500">{p.platform}</span>
                {p.publishedAt ? <span className="text-xs text-zinc-500 ml-auto">{p.publishedAt.toLocaleString("ko-KR")}</span> : null}
              </div>
              <div className="text-sm text-zinc-300 line-clamp-3 whitespace-pre-line">{p.caption}</div>
              {p.errorMessage ? <div className="text-xs text-red-400 mt-2">⚠ {p.errorMessage}</div> : null}
              {p.permalink ? (
                <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-yellow-300 hover:text-yellow-200">↗ {p.platform}에서 보기</a>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function RunPill({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs ${badgeRun(status)}`}>{status}</span>;
}

function badgeRun(s: string): string {
  if (s === "done") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  if (s === "publishing" || s === "rendering" || s === "generating") return "bg-yellow-500/20 text-yellow-300";
  return "bg-zinc-700/40 text-zinc-300";
}
function badgePost(s: string): string {
  if (s === "published") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  return "bg-zinc-700/40 text-zinc-300";
}

function safeCron(s: string): string {
  try { return cronstrue.toString(s, { locale: "ko" }); } catch { return "유효하지 않은 cron"; }
}
function cronError(s: string): string | undefined {
  try { cronstrue.toString(s); return undefined; } catch { return "잘못된 cron 표현식"; }
}
