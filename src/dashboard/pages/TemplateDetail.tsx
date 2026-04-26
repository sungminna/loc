import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, ErrorBox } from "../components/States";
import { Field } from "../components/Field";
import { LivePlayer } from "../components/LivePlayer";
import { getComposition } from "../components/composition-registry";

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
  bgMode: "ai" | "default-image";
  defaultBgR2Key: string;
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
      bgMode: (t.bgMode ?? "ai") as Form["bgMode"],
      defaultBgR2Key: t.defaultBgR2Key ?? "",
    });
  }, [detail.data?.template?.id]);

  if (detail.isLoading || !form) return <Skeleton rows={4} height="h-32" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  if (!detail.data) return null;

  const tpl = detail.data.template;
  const isShared = detail.data.isShared;
  const entry = getComposition(tpl.compositionId);

  return (
    <div className="space-y-6">
      <header>
        <Link to="/templates" className="text-zinc-500 text-sm hover:text-zinc-300">← Templates</Link>
        <div className="flex items-end justify-between mt-2 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">{tpl.name}</h1>
            <div className="text-zinc-400 mt-1 text-sm flex flex-wrap items-center gap-2">
              <code className="text-zinc-300">{tpl.slug}</code>
              <span className="text-zinc-600">·</span>
              <KindBadge kind={tpl.kind} />
              <span className="text-zinc-600">·</span>
              <span>composition <code className="text-zinc-300">{tpl.compositionId}</code></span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full border border-zinc-700" style={{ background: tpl.accentColor }} />
                <code className="text-zinc-400 text-xs">{tpl.accentColor}</code>
              </span>
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs">{tpl.bgMode === "ai" ? "AI bg" : "static bg"}</span>
              {isShared ? <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs">공유</span> : null}
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

      <div className="grid grid-cols-12 gap-6">
        {/* ─── Live preview ───────────────────────────────── */}
        <section className="col-span-5 space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-400">디자인 미리보기</h2>
            <div className="text-xs text-zinc-500">{entry ? `${entry.fps}fps · ${entry.width}×${entry.height}` : null}</div>
          </div>

          <div className="aspect-[9/16] w-full">
            {entry ? (
              <LivePlayer
                compositionId={tpl.compositionId}
                inputProps={previewPropsFromTemplate(tpl)}
                rounded="rounded-2xl"
              />
            ) : (
              <div className="aspect-[9/16] rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs text-zinc-500 text-center px-6">
                Composition <code className="mx-1 text-zinc-300">{tpl.compositionId}</code> 가 등록되지 않았습니다.
                <br />Root.tsx에 추가하거나 다른 composition id를 사용하세요.
              </div>
            )}
          </div>

          <PreviewExplainer tpl={tpl} entry={entry} />
        </section>

        {/* ─── Edit form ───────────────────────────────────── */}
        <section className="col-span-7 space-y-4">
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
              <Field label="길이 (초)" hint="reel-video는 씬 합산이라 무시됨">
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
              <Field label="전환 효과" hint="슬라이드 간 트랜지션 (현재 컴포지션 내장 spring + maskWipe 우선)">
                <select className="input" value={form.transitionPreset}
                  onChange={(e) => setForm({ ...form, transitionPreset: e.target.value as Transition })}>
                  {TRANSITIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="기본 mood" hint="콤마 구분 — select-audio 가 BGM 매칭에 사용">
                <input className="input" value={form.defaultAudioMood.join(", ")}
                  onChange={(e) => setForm({ ...form, defaultAudioMood: parseTags(e.target.value) })} />
              </Field>
              <Field label="배경 모드" hint="ai = 매 슬라이드/씬마다 gpt-image-2 자동 생성. default-image = R2 정적 이미지.">
                <select className="input" value={form.bgMode}
                  onChange={(e) => setForm({ ...form, bgMode: e.target.value as Form["bgMode"] })}>
                  <option value="ai">AI 생성 (gpt-image-2)</option>
                  <option value="default-image">기본 이미지</option>
                </select>
              </Field>
            </div>

            <div className="mt-3">
              <Field label="기본 배경 R2 key" hint="bgMode=default-image이거나 토픽 imageMode=ai-first-only/template-only일 때 폴백. 빈 값 = 그라데이션.">
                <input className="input font-mono text-xs"
                  value={form.defaultBgR2Key}
                  onChange={(e) => setForm({ ...form, defaultBgR2Key: e.target.value })}
                  placeholder="templates/<slug>/bg.webp" />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="배경 이미지 프롬프트 템플릿" hint="content-plan이 슬라이드별 bgImagePrompt 만들 때 prefix로 결합. 토픽의 imageStylePrompt가 추가로 앞에 붙습니다.">
                <textarea className="input min-h-24 font-mono text-xs"
                  value={form.bgPromptTemplate}
                  onChange={(e) => setForm({ ...form, bgPromptTemplate: e.target.value })}
                  placeholder="Cinematic editorial style, 50mm lens, soft daylight..."
                />
              </Field>
            </div>

            <details className="mt-4 card">
              <summary className="cursor-pointer text-sm text-zinc-400">고급: defaults / schema (JSON)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="defaults" hint="컴포지션 기본 props.">
                  <textarea className="input min-h-32 font-mono text-xs"
                    value={JSON.stringify(form.defaults, null, 2)}
                    onChange={(e) => {
                      try {
                        setForm({ ...form, defaults: JSON.parse(e.target.value || "{}") });
                      } catch { /* keep typing */ }
                    }} />
                </Field>
                <Field label="schema" hint="대시보드 입력 가이드용 JSON 스키마.">
                  <textarea className="input min-h-32 font-mono text-xs"
                    value={JSON.stringify(form.schema, null, 2)}
                    onChange={(e) => {
                      try {
                        setForm({ ...form, schema: JSON.parse(e.target.value || "{}") });
                      } catch { /* keep typing */ }
                    }} />
                </Field>
              </div>
            </details>

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

// ─── Helpers ─────────────────────────────────────────────────────────

interface TemplateRow {
  kind: string;
  compositionId: string;
  accentColor: string;
}

// Build a sample preview that uses the template's accent (if the comp
// supports an accent prop) but otherwise falls back to defaults — i.e.
// the template-level visual identity, not topic-specific content.
function previewPropsFromTemplate(tpl: TemplateRow): Record<string, unknown> {
  // SeedanceReel reads the `accent` prop and tints the chapter / stat cards.
  if (tpl.compositionId === "SeedanceReel") {
    return { accent: tpl.accentColor };
  }
  return {};
}

function KindBadge({ kind }: { kind: string }) {
  const style: Record<string, string> = {
    "reel-cards": "bg-blue-500/15 text-blue-300 border-blue-500/30",
    "reel-animated": "bg-purple-500/15 text-purple-300 border-purple-500/30",
    "reel-video": "bg-rose-500/15 text-rose-300 border-rose-500/30",
    "threads-photo": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
  const cls = style[kind] ?? "bg-zinc-700/40 text-zinc-300 border-zinc-700";
  return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{kind}</span>;
}

interface PreviewExplainerProps {
  tpl: TemplateRow & { kind: string; compositionId: string; bgMode: string };
  entry: ReturnType<typeof getComposition>;
}

function PreviewExplainer({ tpl, entry }: PreviewExplainerProps) {
  const kind = tpl.kind;
  return (
    <div className="card text-xs space-y-2 leading-relaxed">
      <div className="text-zinc-300 font-medium">위 미리보기는 템플릿 디자인 자체입니다.</div>
      <ul className="text-zinc-500 space-y-1.5 list-disc pl-4">
        {kind === "reel-video" ? (
          <>
            <li>씬마다 들어갈 영상은 런타임에 <code className="text-zinc-300">bytedance/seedance-2.0</code>이 토픽 내용+스토리라인 기반으로 생성합니다. 미리보기에선 그라데이션 placeholder.</li>
            <li>chapter 라벨 / 헤드라인 / stat 카드 / 진행 바 / 워터마크는 템플릿 자체 디자인이므로 위에 그대로 보입니다.</li>
            <li>오디오는 Seedance가 씬에 직접 만들고 (대사/효과음), BGM은 select-audio가 매번 토픽 mood로 골라 ducking 합니다.</li>
          </>
        ) : kind === "threads-photo" ? (
          <>
            <li>1080×1350 정적 이미지. 헤드라인/본문은 토픽 brief에서 가져옵니다.</li>
            <li>배경은 <code className="text-zinc-300">openai/gpt-image-2</code>가 토픽의 imageStylePrompt + 위 bgPromptTemplate로 매번 생성.</li>
          </>
        ) : (
          <>
            <li>슬라이드 텍스트(kicker/headline/body/emphasis/stat)는 런타임에 content-plan 스킬이 씁니다. 미리보기는 샘플 카피.</li>
            <li>슬라이드 배경 이미지는 <code className="text-zinc-300">openai/gpt-image-2</code>가 토픽의 imageMode + 이 템플릿의 bgPromptTemplate로 생성. {tpl.bgMode === "default-image" ? "이 템플릿은 정적 이미지 모드라 바뀌지 않습니다." : "현재 ai 모드입니다."}</li>
            <li>음악은 select-audio가 토픽+템플릿 mood 매칭으로 자동 선택.</li>
          </>
        )}
        {entry ? <li>총 길이 {(entry.durationFromProps(entry.defaults) / entry.fps).toFixed(1)}s — 슬라이드 수에 따라 가변.</li> : null}
      </ul>
    </div>
  );
}

function parseTags(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
