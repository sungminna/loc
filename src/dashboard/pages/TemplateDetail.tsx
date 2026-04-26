import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

const TRANSITIONS = ["fade", "slide-up", "zoom", "kenburns", "none"] as const;
type Transition = (typeof TRANSITIONS)[number];

interface Form {
  name: string;
  durationSec: number;
  defaultAudioMood: string[];
  accentColor: string;
  bgPromptTemplate: string;
  transitionPreset: Transition;
  defaults: Record<string, unknown>;
  schema: Record<string, unknown>;
}

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <TemplateDetailInner id={id} />;
}

function TemplateDetailInner({ id }: { id: string }) {
  const detail = trpc.templates.get.useQuery({ id });
  const utils = trpc.useUtils();
  const toast = useToast();
  const navigate = useNavigate();

  const update = trpc.templates.update.useMutation({
    onSuccess: () => { utils.templates.get.invalidate({ id }); utils.templates.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.templates.remove.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); navigate("/templates"); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const duplicate = trpc.templates.duplicate.useMutation({
    onSuccess: (row) => { utils.templates.list.invalidate(); if (row?.id) navigate(`/templates/${row.id}`); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (!detail.data) return;
    const t = detail.data.template;
    setForm({
      name: t.name,
      durationSec: t.durationSec,
      defaultAudioMood: t.defaultAudioMood ?? [],
      accentColor: t.accentColor,
      bgPromptTemplate: t.bgPromptTemplate,
      transitionPreset: t.transitionPreset as Transition,
      defaults: t.defaults ?? {},
      schema: t.schema ?? {},
    });
  }, [detail.data?.template?.id]);

  if (detail.isLoading || !form) return <Skeleton rows={4} height="h-32" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  if (!detail.data) return null;

  const tpl = detail.data.template;
  const isShared = detail.data.isShared;
  const previewSlides = (tpl.defaults as { slides?: PreviewSlide[] }).slides ?? FALLBACK_SLIDES;

  return (
    <div className="space-y-8">
      <header>
        <Link to="/templates" className="text-zinc-500 text-sm hover:text-zinc-300">← Templates</Link>
        <div className="flex items-end justify-between mt-2 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">{tpl.name}</h1>
            <div className="text-zinc-400 mt-1 text-sm">
              <code className="text-zinc-300">{tpl.slug}</code> · {tpl.kind} · composition <code className="text-zinc-300">{tpl.compositionId}</code>
              {isShared ? <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded text-xs">공유</span> : null}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn btn-ghost" onClick={() => {
              const newSlug = window.prompt("새 슬러그 (kebab-case)", `${tpl.slug}-copy`);
              if (newSlug && /^[a-z0-9-]+$/.test(newSlug)) duplicate.mutate({ id, newSlug });
            }}>복제</button>
            {!isShared ? (
              <button className="btn btn-danger" onClick={() => {
                if (confirm(`"${tpl.name}" 삭제?`)) remove.mutate({ id });
              }}>삭제</button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-2 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-400">미리보기</h2>
          <div
            className="rounded-2xl overflow-hidden border border-zinc-800 aspect-[9/16] relative"
            style={{ background: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)" }}
          >
            <SlidePreview slide={previewSlides[0] ?? FALLBACK_SLIDES[0]!} accent={form.accentColor} index={0} total={previewSlides.length} />
          </div>
          <div className="text-xs text-zinc-500">
            첫 슬라이드 디자인 미리보기. 실제 렌더는 <code className="text-zinc-300">src/remotion/Root.tsx</code> 컴포지션 <code className="text-zinc-300">{tpl.compositionId}</code>에서 수행됩니다.
          </div>
        </section>

        <section className="col-span-3 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-400">속성</h2>

          {isShared ? (
            <div className="card border-amber-500/30 bg-amber-500/5">
              <div className="text-amber-300 text-sm">공유 템플릿은 직접 편집할 수 없습니다.</div>
              <div className="text-zinc-400 text-xs mt-1">변경하려면 위의 “복제” 버튼으로 내 템플릿으로 만든 뒤 편집하세요.</div>
            </div>
          ) : null}

          <fieldset disabled={isShared} className={isShared ? "opacity-60 pointer-events-none" : ""}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="이름">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="길이 (초)">
                <input className="input" type="number" min={3} max={90}
                  value={form.durationSec}
                  onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
              </Field>
              <Field label="강조 색상" hint="hex (#RRGGBB)">
                <div className="flex gap-2">
                  <input type="color" className="h-10 w-12 bg-zinc-900 border border-zinc-800 rounded"
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
                  <input className="input font-mono text-xs flex-1"
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
                </div>
              </Field>
              <Field label="전환 효과" hint="슬라이드 간 트랜지션">
                <select className="input" value={form.transitionPreset}
                  onChange={(e) => setForm({ ...form, transitionPreset: e.target.value as Transition })}>
                  {TRANSITIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="기본 mood" hint="콤마 구분">
                <input className="input" value={form.defaultAudioMood.join(", ")}
                  onChange={(e) => setForm({ ...form, defaultAudioMood: parseTags(e.target.value) })} />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="배경 이미지 프롬프트 템플릿" hint="content-plan 스킬이 슬라이드별 bgImagePrompt를 만들 때 참고합니다. 예: 'Minimal high-contrast {topic} backdrop, soft daylight, 50mm lens'">
                <textarea className="input min-h-24 font-mono text-xs"
                  value={form.bgPromptTemplate}
                  onChange={(e) => setForm({ ...form, bgPromptTemplate: e.target.value })}
                  placeholder="Minimal high-contrast backdrop with soft daylight..."
                />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="defaults (JSON)" hint="컴포지션의 기본 props. 슬라이드 outline 등.">
                <textarea
                  className="input min-h-32 font-mono text-xs"
                  value={JSON.stringify(form.defaults, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "{}");
                      setForm({ ...form, defaults: parsed });
                    } catch { /* keep typing */ }
                  }}
                />
              </Field>
              <Field label="schema (JSON)" hint="UI에서 props 입력을 가이드하는 zod-like JSON 스키마.">
                <textarea
                  className="input min-h-32 font-mono text-xs"
                  value={JSON.stringify(form.schema, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "{}");
                      setForm({ ...form, schema: parsed });
                    } catch { /* keep typing */ }
                  }}
                />
              </Field>
            </div>

            <div className="mt-5">
              <button className="btn btn-primary" onClick={() => update.mutate({ id, ...form })} disabled={update.isPending}>
                {update.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </fieldset>
        </section>
      </div>

      <section className="card">
        <h2 className="font-semibold mb-3">이 템플릿을 사용하는 토픽 ({detail.data.topicsUsing.length})</h2>
        {detail.data.topicsUsing.length === 0 ? (
          <div className="text-sm text-zinc-500">아직 이 템플릿을 사용하는 토픽이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {detail.data.topicsUsing.map((tp) => (
              <Link to={`/topics/${tp.id}`} key={tp.id} className="block border border-zinc-800 rounded-lg p-3 hover:border-yellow-300/50 transition">
                <div className="font-medium">{tp.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{tp.cron} · 일일 {tp.dailyRunCap}회</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface PreviewSlide {
  kicker?: string;
  headline?: string;
  body?: string;
  emphasis?: string;
}

const FALLBACK_SLIDES: PreviewSlide[] = [
  { kicker: "TREND", headline: "오늘의 키워드", body: "지금 가장 뜨거운 주제 한 줄 요약." },
  { headline: "Why it matters", body: "왜 이 트렌드를 알아야 하는지." },
  { headline: "The shift", body: "변하는 것 vs 그대로인 것." },
  { headline: "Action", body: "이번 주에 시도해볼 것 3가지." },
  { headline: "Save this", body: "다음에 써먹을 수 있게 저장.", emphasis: "🔖" },
];

function SlidePreview({ slide, accent, index, total }: { slide: PreviewSlide; accent: string; index: number; total: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-3 left-3 right-3 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/15">
            <div className="h-full" style={{ width: i < index ? "100%" : i === index ? "55%" : "0%", background: accent }} />
          </div>
        ))}
      </div>
      <div
        className="rounded-3xl px-6 py-7 backdrop-blur-md w-full max-w-[80%]"
        style={{
          background: "rgba(15,8,30,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {slide.kicker ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-3" style={{ color: accent }}>{slide.kicker}</div>
        ) : null}
        <div className="text-2xl font-black leading-tight text-zinc-100">{slide.headline ?? "Headline"}</div>
        {slide.body ? <div className="text-zinc-300/80 text-sm mt-3 leading-snug">{slide.body}</div> : null}
        {slide.emphasis ? <div className="text-3xl mt-2">{slide.emphasis}</div> : null}
        <div className="text-[10px] tracking-[0.3em] text-zinc-500 mt-5">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
      <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] tracking-widest text-zinc-400">
        Loc · @yourhandle
      </div>
    </div>
  );
}

function parseTags(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
