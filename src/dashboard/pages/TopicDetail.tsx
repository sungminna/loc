import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import cronstrue from "cronstrue";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, ErrorBox } from "../components/States";
import { Field } from "../components/Field";
import { LivePlayer } from "../components/LivePlayer";
import { getComposition } from "../components/composition-registry";

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
  imageMode: "ai-all" | "ai-first-only" | "template-only";
  threadsFormat: "text" | "image";
  hashtagMode: "ai" | "fixed" | "mixed";
  fixedHashtags: string[];
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
    imageMode: topic.imageMode,
    threadsFormat: topic.threadsFormat,
    hashtagMode: topic.hashtagMode,
    fixedHashtags: topic.fixedHashtags,
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="이미지 자동화" hint="AI가 슬라이드 배경을 얼마나 자율적으로 만들지. ai-all = 전체 자동, ai-first-only = 첫 슬라이드만, template-only = 템플릿 기본만.">
          <select className="input" value={form.imageMode}
            onChange={(e) => setForm({ ...form, imageMode: e.target.value as TopicLite["imageMode"] })}>
            <option value="ai-all">AI 전체 자동 생성</option>
            <option value="ai-first-only">첫 슬라이드만 AI · 나머지 템플릿</option>
            <option value="template-only">템플릿 기본 이미지만</option>
          </select>
        </Field>
        <Field label="Threads 포맷" hint="text = 글만, image = ThreadsCard 이미지+글">
          <select className="input" value={form.threadsFormat}
            onChange={(e) => setForm({ ...form, threadsFormat: e.target.value as TopicLite["threadsFormat"] })}>
            <option value="image">이미지 + 글</option>
            <option value="text">글만</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="해시태그 모드" hint="ai = 매 실행마다 새로 생성. fixed = 고정만. mixed = 둘 다 합쳐서 dedupe.">
          <select className="input" value={form.hashtagMode}
            onChange={(e) => setForm({ ...form, hashtagMode: e.target.value as TopicLite["hashtagMode"] })}>
            <option value="ai">AI 자동 생성</option>
            <option value="fixed">고정만</option>
            <option value="mixed">AI + 고정</option>
          </select>
        </Field>
        <Field label="고정 해시태그" hint="공백/콤마 구분. # 자동 제거. fixed/mixed 모드에서 사용.">
          <input className="input" value={form.fixedHashtags.join(" ")}
            onChange={(e) => setForm({
              ...form,
              fixedHashtags: e.target.value.split(/[\s,]+/).map((s) => s.replace(/^#+/, "")).filter(Boolean).slice(0, 30),
            })} />
        </Field>
      </div>

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
  attribution?: string;
  stat?: { value?: string; label?: string; suffix?: string };
  bgImageUrl?: string;
  bgImageR2Key?: string;
  bgImagePrompt?: string;
}

interface SceneDraft {
  kicker?: string;
  chapter?: string;
  headline?: string;
  body?: string;
  stat?: { value?: string; label?: string; suffix?: string };
  videoPrompt?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  resolution?: "480p" | "720p";
  generateAudio?: boolean;
  seed?: number;
  cameraMove?: string;
  mood?: string;
  firstFrameImagePrompt?: string;
  firstFrameImageR2Key?: string;
  lastFrameImagePrompt?: string;
  lastFrameImageR2Key?: string;
  videoR2Key?: string;
}

interface DraftBrief {
  topic?: { headline?: string; angle?: string };
  slides?: SlideDraft[];
  video?: { scenes?: SceneDraft[]; accent?: string };
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
  const templates = trpc.templates.list.useQuery();
  const selectedTemplate = (templates.data ?? []).find((t) => t.slug === topic.templateSlugs[0]);
  const compositionId = selectedTemplate?.compositionId ?? "CardNews";
  const templateAccent = selectedTemplate?.accentColor ?? "#facc15";
  const isVideoReel = compositionId === "SeedanceReel" || selectedTemplate?.kind === "reel-video";

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
    return isVideoReel
      ? { slides: defaultSlides(), video: { scenes: defaultScenes() } }
      : { slides: defaultSlides() };
  }, [topic.id, isVideoReel]);

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

  // ─── Live preview props (passed to LivePlayer above) ────────────
  const previewProps = useMemo<Record<string, unknown>>(() => {
    if (isVideoReel) {
      const scenes = (draft.video?.scenes ?? []).map((s) => ({
        kicker: s.kicker,
        chapter: s.chapter,
        headline: s.headline,
        body: s.body,
        stat: s.stat?.value ? { value: s.stat.value, label: s.stat.label, suffix: s.stat.suffix } : undefined,
        durationSec: s.durationSec ?? 5,
        videoUrl: s.videoR2Key ? `${publicMediaBase}/${s.videoR2Key}` : undefined,
      }));
      return {
        brand: { handle: "@yourhandle", name: "Loc" },
        lang: topic.lang === "en" ? "en" : "ko",
        accent: draft.video?.accent ?? templateAccent,
        scenes: scenes.length ? scenes : undefined,
      };
    }
    const slides = (draft.slides ?? []).map((s) => ({
      kicker: s.kicker,
      headline: s.headline ?? "",
      body: s.body,
      emphasis: s.emphasis,
      attribution: s.attribution,
      stat: s.stat?.value ? { value: s.stat.value, label: s.stat.label, suffix: s.stat.suffix } : undefined,
      bgImageUrl: s.bgImageUrl ?? (s.bgImageR2Key ? `${publicMediaBase}/${s.bgImageR2Key}` : undefined),
    }));
    return {
      brand: { handle: "@yourhandle", name: "Loc" },
      lang: topic.lang === "en" ? "en" : "ko",
      slides: slides.length ? slides : undefined,
    };
  }, [draft, publicMediaBase, isVideoReel, templateAccent, topic.lang]);

  return (
    <section className="space-y-5">
      {/* ─── Save bar ─────────────────────────────────── */}
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium">
            초안 ·{" "}
            {isVideoReel
              ? `${draft.video?.scenes?.length ?? 0} 씬`
              : `${draft.slides?.length ?? 0} 슬라이드`}
            {selectedTemplate ? <span className="ml-2 text-xs text-zinc-500">({selectedTemplate.name} · {compositionId})</span> : null}
          </div>
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

      {/* ─── Full draft preview ─────────────────────────── */}
      <div className="grid grid-cols-[300px_1fr] gap-5">
        <div>
          <div className="text-xs text-zinc-500 mb-2">전체 미리보기 · {compositionId}</div>
          <LivePlayer
            compositionId={compositionId}
            inputProps={previewProps}
            controls
            loop
            autoPlay
          />
        </div>
        <div className="card text-xs space-y-2 leading-relaxed">
          <div className="text-zinc-300 font-medium">미리보기는 현재 초안을 그대로 재생합니다.</div>
          <ul className="text-zinc-500 space-y-1.5 list-disc pl-4">
            {isVideoReel ? (
              <>
                <li>각 씬 영상 클립은 <code className="text-zinc-300">bytedance/seedance-2.0</code>이 런타임에 생성합니다. 아직 비어있는 씬은 그라데이션으로 표시됨.</li>
                <li>오버레이(챕터·헤드라인·stat 카드)는 입력한 텍스트가 그대로 적용됩니다.</li>
                <li>씬 prompt/duration/aspectRatio 등 모든 Seedance 파라미터를 아래 ScenesEditor에서 조정.</li>
              </>
            ) : (
              <>
                <li>슬라이드 배경 이미지는 위에서 직접 생성한 것이 있으면 반영됩니다. 없으면 그라데이션 (런타임에 <code className="text-zinc-300">openai/gpt-image-2</code>가 채움).</li>
                <li>헤드라인/본문/kicker/emphasis/stat은 모두 입력한 그대로 렌더링.</li>
                <li>전체 길이는 슬라이드 수에 따라 자동 계산 (각 ~3-3.5초).</li>
              </>
            )}
          </ul>
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

      {/* ─── Slide editor (always shown — orchestrator uses slides[] as outline even for video reels) ─── */}
      {!isVideoReel ? (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">슬라이드</div>
          {(draft.slides ?? []).map((slide, i) => (
            <SlideEditor
              key={i}
              slide={slide}
              index={i}
              total={draft.slides?.length ?? 1}
              genIdx={genIdx}
              compositionId={compositionId}
              accent={templateAccent}
              publicMediaBase={publicMediaBase}
              onChange={(patch) => setSlide(i, patch)}
              onMove={(dir) => moveSlide(i, dir)}
              onRemove={() => removeSlide(i)}
              onRegen={() => regenSlideImage(i)}
            />
          ))}
          <button className="btn btn-ghost w-full border border-dashed border-zinc-700 py-3" onClick={addSlide}>+ 슬라이드 추가</button>
        </div>
      ) : (
        <ScenesEditor
          scenes={draft.video?.scenes ?? []}
          accent={templateAccent}
          publicMediaBase={publicMediaBase}
          onChange={(scenes) => setDraft({ ...draft, video: { ...(draft.video ?? {}), scenes } })}
        />
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold">Threads 카드</h3>
        <div className="grid grid-cols-[180px_1fr] gap-4">
          <ThreadsCardThumb
            url={draft.threads?.bgImageUrl ?? (draft.threads?.bgImageR2Key ? `${publicMediaBase}/${draft.threads.bgImageR2Key}` : undefined)}
            loading={genIdx === -1}
            text={draft.threads?.text ?? ""}
          />
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

// ─── Per-slide editor with live mini-player ────────────────────────────

function SlideEditor({
  slide, index, total, genIdx, compositionId, accent, publicMediaBase,
  onChange, onMove, onRemove, onRegen,
}: {
  slide: SlideDraft;
  index: number;
  total: number;
  genIdx: number | null;
  compositionId: string;
  accent: string;
  publicMediaBase: string;
  onChange: (patch: Partial<SlideDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onRegen: () => void;
}) {
  // Compute the [start, end] frame range for this slide so the mini-player
  // loops on just this single slide's animation. We pass a one-slide
  // inputProps shadow so the slide gets index 0/1 and reads as the only
  // visible card — clean preview without the surrounding slides bleeding in.
  const oneSlideProps = useMemo<Record<string, unknown>>(() => ({
    brand: { handle: "@yourhandle", name: "Loc" },
    lang: "ko",
    slides: [{
      kicker: slide.kicker,
      headline: slide.headline ?? "",
      body: slide.body,
      emphasis: slide.emphasis,
      attribution: slide.attribution,
      stat: slide.stat?.value ? slide.stat : undefined,
      bgImageUrl: slide.bgImageUrl ?? (slide.bgImageR2Key ? `${publicMediaBase}/${slide.bgImageR2Key}` : undefined),
    }],
  }), [slide, publicMediaBase]);

  const loading = genIdx === index;

  return (
    <div className="card grid grid-cols-[180px_1fr] gap-4">
      <div className="relative">
        <LivePlayer
          compositionId={compositionId}
          inputProps={oneSlideProps}
          controls={false}
          loop
          autoPlay
          rounded="rounded-xl"
        />
        {loading ? (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center text-xs bg-black/70 backdrop-blur-sm text-yellow-300 animate-pulse">
            이미지 생성 중...
          </div>
        ) : null}
        <div className="absolute top-2 left-2 right-2 flex gap-0.5 pointer-events-none">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20">
              <div className="h-full" style={{ width: i === index ? "60%" : "0%", background: accent }} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs text-zinc-500">slide #{index + 1}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost text-xs" onClick={() => onMove(-1)} disabled={index === 0}>↑</button>
            <button className="btn btn-ghost text-xs" onClick={() => onMove(1)} disabled={index === total - 1}>↓</button>
            <button className="btn btn-danger text-xs" onClick={onRemove}>삭제</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Kicker">
            <input className="input text-sm" value={slide.kicker ?? ""}
              onChange={(e) => onChange({ kicker: e.target.value })} placeholder="TREND" />
          </Field>
          <Field label="Emphasis">
            <input className="input text-sm" value={slide.emphasis ?? ""}
              onChange={(e) => onChange({ emphasis: e.target.value })} placeholder="🔖" />
          </Field>
          <Field label="bg R2 key" hint="자동으로 채워짐">
            <input className="input text-xs font-mono" value={slide.bgImageR2Key ?? ""}
              onChange={(e) => onChange({ bgImageR2Key: e.target.value })} />
          </Field>
        </div>
        <Field label="Headline">
          <input className="input" value={slide.headline ?? ""}
            onChange={(e) => onChange({ headline: e.target.value })} />
        </Field>
        <Field label="Body">
          <textarea className="input min-h-20" value={slide.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value })} />
        </Field>

        <details className="border-t border-zinc-800 pt-2">
          <summary className="text-xs text-zinc-400 cursor-pointer">통계 / 인용 (DataStory · NeoBrutalism · QuoteSpotlight)</summary>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Field label="stat 값">
              <input className="input text-sm" value={slide.stat?.value ?? ""}
                onChange={(e) => onChange({ stat: { ...(slide.stat ?? {}), value: e.target.value } })}
                placeholder="73" />
            </Field>
            <Field label="stat 단위">
              <input className="input text-sm" value={slide.stat?.suffix ?? ""}
                onChange={(e) => onChange({ stat: { ...(slide.stat ?? {}), suffix: e.target.value } })}
                placeholder="%" />
            </Field>
            <Field label="stat 레이블">
              <input className="input text-sm" value={slide.stat?.label ?? ""}
                onChange={(e) => onChange({ stat: { ...(slide.stat ?? {}), label: e.target.value } })} />
            </Field>
          </div>
          <Field label="quote 출처 (QuoteSpotlight 전용)">
            <input className="input text-sm" value={slide.attribution ?? ""}
              onChange={(e) => onChange({ attribution: e.target.value })}
              placeholder="— 어떤 작가" />
          </Field>
        </details>

        <div className="border-t border-zinc-800 pt-3">
          <Field label="배경 이미지 프롬프트" hint="topic.imageStylePrompt 가 자동으로 앞에 붙습니다.">
            <textarea className="input min-h-16 font-mono text-xs" value={slide.bgImagePrompt ?? ""}
              onChange={(e) => onChange({ bgImagePrompt: e.target.value })}
              placeholder="bold composition, single focal subject, high contrast..." />
          </Field>
          <div className="flex justify-end mt-2 gap-2">
            {slide.bgImageR2Key ? (
              <button className="btn btn-ghost text-xs" onClick={() => onChange({ bgImageR2Key: undefined, bgImageUrl: undefined })}>
                이미지 제거
              </button>
            ) : null}
            <button className="btn btn-primary text-xs" onClick={onRegen} disabled={loading}>
              {loading ? "생성 중... (~30s)" : "이미지 생성/재생성"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Per-scene editor (reel-video topics) ──────────────────────────────

function ScenesEditor({
  scenes, accent, publicMediaBase, onChange,
}: {
  scenes: SceneDraft[];
  accent: string;
  publicMediaBase: string;
  onChange: (scenes: SceneDraft[]) => void;
}) {
  function setScene(i: number, patch: Partial<SceneDraft>) {
    const next = [...scenes];
    next[i] = { ...(next[i] ?? {}), ...patch };
    onChange(next);
  }
  function addScene() {
    onChange([...scenes, { chapter: "SCENE", durationSec: 5, generateAudio: true, aspectRatio: "9:16", resolution: "720p" }]);
  }
  function removeScene(i: number) {
    const next = [...scenes];
    next.splice(i, 1);
    onChange(next);
  }
  function moveScene(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    const a = next[i]!;
    const b = next[j]!;
    next[i] = b;
    next[j] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center justify-between">
        <span>씬 ({scenes.length})</span>
        <span className="text-zinc-500 normal-case font-normal">총 {scenes.reduce((acc, s) => acc + (s.durationSec ?? 5), 0).toFixed(1)}s</span>
      </div>
      {scenes.map((scene, i) => (
        <SceneEditor
          key={i}
          scene={scene}
          index={i}
          total={scenes.length}
          accent={accent}
          publicMediaBase={publicMediaBase}
          onChange={(patch) => setScene(i, patch)}
          onMove={(dir) => moveScene(i, dir)}
          onRemove={() => removeScene(i)}
        />
      ))}
      <button className="btn btn-ghost w-full border border-dashed border-zinc-700 py-3" onClick={addScene}>+ 씬 추가</button>
    </div>
  );
}

function SceneEditor({
  scene, index, total, accent, publicMediaBase,
  onChange, onMove, onRemove,
}: {
  scene: SceneDraft;
  index: number;
  total: number;
  accent: string;
  publicMediaBase: string;
  onChange: (patch: Partial<SceneDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const previewProps = useMemo<Record<string, unknown>>(() => ({
    brand: { handle: "@yourhandle", name: "Loc" },
    lang: "ko",
    accent,
    scenes: [{
      kicker: scene.kicker,
      chapter: scene.chapter,
      headline: scene.headline,
      body: scene.body,
      stat: scene.stat?.value ? { value: scene.stat.value, label: scene.stat.label, suffix: scene.stat.suffix } : undefined,
      durationSec: scene.durationSec ?? 5,
      videoUrl: scene.videoR2Key ? `${publicMediaBase}/${scene.videoR2Key}` : undefined,
    }],
  }), [scene, accent, publicMediaBase]);

  return (
    <div className="card grid grid-cols-[200px_1fr] gap-4">
      <div className="relative">
        <LivePlayer
          compositionId="SeedanceReel"
          inputProps={previewProps}
          controls={false}
          loop
          autoPlay
          rounded="rounded-xl"
        />
        {!scene.videoR2Key ? (
          <div className="absolute bottom-2 left-2 right-2 text-[10px] text-center bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-zinc-300">
            영상은 런타임 생성
          </div>
        ) : null}
        <div className="absolute top-2 left-2 right-2 flex gap-0.5 pointer-events-none">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20">
              <div className="h-full" style={{ width: i === index ? "60%" : "0%", background: accent }} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs text-zinc-500">scene #{index + 1}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost text-xs" onClick={() => onMove(-1)} disabled={index === 0}>↑</button>
            <button className="btn btn-ghost text-xs" onClick={() => onMove(1)} disabled={index === total - 1}>↓</button>
            <button className="btn btn-danger text-xs" onClick={onRemove}>삭제</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Chapter" hint="좌상단 라벨, 예: OPENING / SHIFT / ACTION">
            <input className="input text-sm" value={scene.chapter ?? ""}
              onChange={(e) => onChange({ chapter: e.target.value })} placeholder="OPENING" />
          </Field>
          <Field label="Kicker" hint="chapter가 없을 때 fallback">
            <input className="input text-sm" value={scene.kicker ?? ""}
              onChange={(e) => onChange({ kicker: e.target.value })} placeholder="TRENDING" />
          </Field>
        </div>
        <Field label="Headline" hint="화면 하단 큰 문구. ≤14자 (KO) / ≤22자 (EN)">
          <input className="input" value={scene.headline ?? ""}
            onChange={(e) => onChange({ headline: e.target.value })} />
        </Field>
        <Field label="Body" hint="hairline 아래 보조 라인">
          <textarea className="input min-h-16" value={scene.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value })} />
        </Field>

        <details>
          <summary className="text-xs text-zinc-400 cursor-pointer">통계 카드 (오른쪽 글래스 카드)</summary>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Field label="값">
              <input className="input text-sm" value={scene.stat?.value ?? ""}
                onChange={(e) => onChange({ stat: { ...(scene.stat ?? {}), value: e.target.value } })} placeholder="73" />
            </Field>
            <Field label="단위">
              <input className="input text-sm" value={scene.stat?.suffix ?? ""}
                onChange={(e) => onChange({ stat: { ...(scene.stat ?? {}), suffix: e.target.value } })} placeholder="%" />
            </Field>
            <Field label="레이블">
              <input className="input text-sm" value={scene.stat?.label ?? ""}
                onChange={(e) => onChange({ stat: { ...(scene.stat ?? {}), label: e.target.value } })} />
            </Field>
          </div>
        </details>

        <div className="border-t border-zinc-800 pt-3 space-y-3">
          <Field label="Seedance 영상 prompt" hint="subject + action + camera + lighting + style 5단계로 작성. 대사는 큰따옴표.">
            <textarea className="input min-h-24 font-mono text-xs" value={scene.videoPrompt ?? ""}
              onChange={(e) => onChange({ videoPrompt: e.target.value })}
              placeholder="A young office worker freezes mid-sentence, eyes widening, slow dolly in, blue-hour overcast light, cinematic 35mm shallow depth of field." />
          </Field>

          <div className="grid grid-cols-4 gap-2">
            <Field label="Duration (초)" hint="3-12 또는 -1=adaptive">
              <input className="input text-sm" type="number" min={-1} max={12}
                value={scene.durationSec ?? 5}
                onChange={(e) => onChange({ durationSec: Number(e.target.value) })} />
            </Field>
            <Field label="Aspect">
              <select className="input text-sm" value={scene.aspectRatio ?? "9:16"}
                onChange={(e) => onChange({ aspectRatio: e.target.value as SceneDraft["aspectRatio"] })}>
                {["9:16", "1:1", "16:9", "3:4", "4:3", "21:9", "adaptive"].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Resolution">
              <select className="input text-sm" value={scene.resolution ?? "720p"}
                onChange={(e) => onChange({ resolution: e.target.value as SceneDraft["resolution"] })}>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </Field>
            <Field label="Seed" hint="재현 가능한 출력. 비우면 랜덤.">
              <input className="input text-sm" type="number"
                value={scene.seed ?? ""}
                onChange={(e) => onChange({ seed: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="카메라 무브">
              <input className="input text-sm" value={scene.cameraMove ?? ""}
                onChange={(e) => onChange({ cameraMove: e.target.value })} placeholder="slow dolly in" />
            </Field>
            <Field label="Mood">
              <input className="input text-sm" value={scene.mood ?? ""}
                onChange={(e) => onChange({ mood: e.target.value })} placeholder="golden hour, soft daylight" />
            </Field>
            <Field label="음성+효과음">
              <label className="input flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={scene.generateAudio ?? true}
                  onChange={(e) => onChange({ generateAudio: e.target.checked })} />
                <span>{scene.generateAudio !== false ? "ON (Seedance 자체 오디오)" : "OFF (BGM만)"}</span>
              </label>
            </Field>
          </div>

          <details>
            <summary className="text-xs text-zinc-400 cursor-pointer">고급: 첫/끝 프레임 이미지 prompt (gpt-image-2)</summary>
            <div className="space-y-2 mt-2">
              <Field label="첫 프레임 prompt" hint="설정 시 image-to-video 모드로 전환. 캐릭터/색감 일관성 확보.">
                <textarea className="input min-h-14 font-mono text-xs" value={scene.firstFrameImagePrompt ?? ""}
                  onChange={(e) => onChange({ firstFrameImagePrompt: e.target.value })} />
              </Field>
              <Field label="끝 프레임 prompt" hint="첫 프레임이 있을 때만 효과. 컨트롤된 컷 효과.">
                <textarea className="input min-h-14 font-mono text-xs" value={scene.lastFrameImagePrompt ?? ""}
                  onChange={(e) => onChange({ lastFrameImagePrompt: e.target.value })} />
              </Field>
            </div>
          </details>

          {scene.videoR2Key ? (
            <div className="text-xs text-emerald-400 flex items-center gap-2">
              <span>✓ 생성된 영상: <code className="text-zinc-300 break-all">{scene.videoR2Key}</code></span>
              <button className="btn btn-ghost text-xs" onClick={() => onChange({ videoR2Key: undefined })}>제거</button>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              영상은 다음 실행 때 orchestrate-run 스킬이 위 파라미터로 <code className="text-zinc-300">bytedance/seedance-2.0</code>을 호출해 생성합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Static still preview for the Threads card. We don't run the full
// ThreadsCard composition here (its native is 1080×1350 still — Player
// would render a single frame anyway), so a CSS approximation is plenty.
function ThreadsCardThumb({ url, loading, text }: { url?: string; loading: boolean; text: string }) {
  return (
    <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-zinc-800"
      style={{ background: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)" }}>
      {url ? <img src={url} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" /> : null}
      <div className="absolute inset-0 p-3 flex flex-col justify-end text-xs">
        <div className="text-white/90 line-clamp-4 font-medium leading-tight whitespace-pre-line">
          {text || "(텍스트 입력)"}
        </div>
      </div>
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs bg-black/70 backdrop-blur-sm text-yellow-300 animate-pulse">
          이미지 생성 중...
        </div>
      ) : null}
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

function defaultScenes(): SceneDraft[] {
  return [
    { chapter: "OPENING", kicker: "TRENDING", headline: "여기서부터 보세요", body: "12초 안에 핵심을 다 보여드립니다.", durationSec: 5, aspectRatio: "9:16", resolution: "720p", generateAudio: true },
    { chapter: "INSIGHT", headline: "왜 지금이냐면", body: "트렌드의 첫 6주가 가장 빠르다.", stat: { value: "73", suffix: "%", label: "초기 진입자 우위" }, durationSec: 6, aspectRatio: "9:16", resolution: "720p", generateAudio: true },
    { chapter: "SHIFT", headline: "핵심 변화 한 가지", body: "익숙했던 기준이 더는 통하지 않는 영역.", durationSec: 5, aspectRatio: "9:16", resolution: "720p", generateAudio: true },
    { chapter: "ACTION", headline: "오늘 시도해 볼 것", body: "1분이면 됩니다.", durationSec: 4, aspectRatio: "9:16", resolution: "720p", generateAudio: true },
    { chapter: "CLOSING", headline: "저장하고 다시 보기", durationSec: 3, aspectRatio: "9:16", resolution: "720p", generateAudio: true },
  ];
}

function briefShape(brief: unknown): DraftBrief {
  if (!brief || typeof brief !== "object") return { slides: defaultSlides() };
  const b = brief as DraftBrief & Record<string, unknown>;
  return {
    topic: b.topic,
    slides: Array.isArray(b.slides) ? b.slides : defaultSlides(),
    video: b.video && typeof b.video === "object" ? b.video : undefined,
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
