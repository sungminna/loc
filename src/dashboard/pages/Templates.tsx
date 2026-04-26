import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { Skeleton, Empty, ErrorBox } from "../components/States";
import { Field } from "../components/Field";
import { LivePlayer } from "../components/LivePlayer";
import { getComposition } from "../components/composition-registry";

interface TemplateForm {
  slug: string;
  name: string;
  kind: "reel-cards" | "reel-animated" | "reel-video" | "threads-photo";
  platform: "instagram" | "threads";
  compositionId: string;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  defaultAudioMood: string[];
  durationSec: number;
  accentColor: string;
  bgPromptTemplate: string;
  transitionPreset: "fade" | "slide-up" | "zoom" | "kenburns" | "none";
  bgMode: "ai" | "default-image";
  defaultBgR2Key: string;
}

const EMPTY: TemplateForm = {
  slug: "",
  name: "",
  kind: "reel-cards",
  platform: "instagram",
  compositionId: "CardNews",
  schema: {},
  defaults: {},
  defaultAudioMood: [],
  durationSec: 18,
  accentColor: "#facc15",
  bgPromptTemplate: "",
  transitionPreset: "fade",
  bgMode: "ai",
  defaultBgR2Key: "",
};

export function Templates() {
  const list = trpc.templates.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const create = trpc.templates.create.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast({ tone: "ok", msg: "템플릿 추가됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const update = trpc.templates.update.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.templates.remove.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast({ tone: "ok", msg: "삭제됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [editing, setEditing] = useState<{ id?: string; form: TemplateForm } | null>(null);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-zinc-400 mt-1">Remotion 컴포지션과 매핑된 콘텐츠 템플릿.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ form: { ...EMPTY } })}>+ 새 템플릿</button>
      </header>

      {list.isLoading ? <Skeleton rows={3} height="h-24" />
        : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} />
        : list.data?.length === 0 ? (
          <Empty
            icon="▣"
            title="템플릿이 없습니다"
            hint="시드 스크립트로 기본 템플릿(card-news-default, threads-card-default)을 추가하거나, 직접 새 템플릿을 등록하세요."
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {list.data?.map((t) => (
              <TemplateCard
                key={t.id}
                tpl={t}
                onEdit={() => setEditing({ id: t.id, form: toForm(t) })}
                onRemove={() => {
                  if (confirm(`"${t.name}" 삭제?`)) remove.mutate({ id: t.id });
                }}
              />
            ))}
          </div>
        )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "템플릿 편집" : "새 템플릿"}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>취소</button>
            <button className="btn btn-primary"
              disabled={!editing?.form.slug || !editing?.form.name || !editing?.form.compositionId}
              onClick={() => {
                if (!editing) return;
                const action = editing.id
                  ? update.mutateAsync({ id: editing.id, ...editing.form })
                  : create.mutateAsync(editing.form);
                action.then(() => setEditing(null)).catch(() => {});
              }}>
              {editing?.id ? "저장" : "추가"}
            </button>
          </>
        }
      >
        {editing && <TemplateEditor form={editing.form} setForm={(f) => setEditing({ ...editing, form: f })} />}
      </Modal>
    </div>
  );
}

function TemplateEditor({ form, setForm }: { form: TemplateForm; setForm: (f: TemplateForm) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="slug" error={form.slug && !/^[a-z0-9-]+$/.test(form.slug) ? "kebab-case만" : undefined}>
          <input className="input font-mono text-xs" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-template" />
        </Field>
        <Field label="이름"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="플랫폼">
          <select className="input" value={form.platform}
            onChange={(e) => {
              const platform = e.target.value as TemplateForm["platform"];
              const kind: TemplateForm["kind"] = platform === "threads" ? "threads-photo" : (form.kind === "threads-photo" ? "reel-cards" : form.kind);
              const compositionId = platform === "threads" ? "ThreadsCard" : (form.compositionId === "ThreadsCard" ? "CardNews" : form.compositionId);
              setForm({ ...form, platform, kind, compositionId });
            }}>
            <option value="instagram">Instagram (Reels)</option>
            <option value="threads">Threads (Photo/Text)</option>
          </select>
        </Field>
        <Field label="종류">
          <select className="input" value={form.kind} onChange={(e) => {
            const kind = e.target.value as TemplateForm["kind"];
            // Auto-suggest a composition for the selected kind when the
            // current value clearly belongs to the other family.
            const slideComps = ["CardNews", "KineticType", "BoldEditorial", "MinimalGrid", "NeoBrutalism", "GlassMorphism", "RetroVHS", "DataStory", "QuoteSpotlight"];
            let compositionId = form.compositionId;
            if (kind === "reel-video" && slideComps.includes(compositionId)) compositionId = "SeedanceReel";
            else if ((kind === "reel-cards" || kind === "reel-animated") && compositionId === "SeedanceReel") compositionId = "CardNews";
            setForm({ ...form, kind, compositionId });
          }}>
            {form.platform === "threads" ? (
              <option value="threads-photo">Threads · Photo</option>
            ) : (
              <>
                <option value="reel-cards">Reel · Cards (정적 슬라이드)</option>
                <option value="reel-animated">Reel · Animated (애니메이션 슬라이드)</option>
                <option value="reel-video">Reel · Video (Seedance 영상)</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Composition ID" hint="src/remotion/Root.tsx에 등록된 id. 카드: CardNews / KineticType / BoldEditorial / MinimalGrid / NeoBrutalism / GlassMorphism / RetroVHS / DataStory / QuoteSpotlight. 영상: SeedanceReel.">
          <input className="input font-mono text-xs" value={form.compositionId} onChange={(e) => setForm({ ...form, compositionId: e.target.value })} />
        </Field>
        <Field label="길이 (초)">
          <input className="input" type="number" min={3} max={90} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
        </Field>
        <Field label="기본 mood" hint="콤마 구분">
          <input className="input" value={form.defaultAudioMood.join(", ")}
            onChange={(e) => setForm({ ...form, defaultAudioMood: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <Field label="배경 모드" hint="ai = 슬라이드별 GPT-Image-2 자동 생성. default-image = 아래 R2 키의 정적 이미지 사용.">
          <select className="input" value={form.bgMode}
            onChange={(e) => setForm({ ...form, bgMode: e.target.value as TemplateForm["bgMode"] })}>
            <option value="ai">AI 생성 (gpt-image-2)</option>
            <option value="default-image">기본 이미지 사용</option>
          </select>
        </Field>
        <Field label="기본 배경 R2 key" hint="bgMode=default-image일 때 사용. 빈 값이면 그라데이션만 표시.">
          <input className="input font-mono text-xs"
            value={form.defaultBgR2Key}
            onChange={(e) => setForm({ ...form, defaultBgR2Key: e.target.value })}
            placeholder="templates/<slug>/bg.webp" />
        </Field>
      </div>
    </div>
  );
}

interface TemplateRow {
  id: string; slug: string; name: string; kind: TemplateForm["kind"]; platform: TemplateForm["platform"];
  compositionId: string;
  schema: Record<string, unknown>; defaults: Record<string, unknown>;
  defaultAudioMood: string[]; durationSec: number;
  accentColor: string; bgPromptTemplate: string; transitionPreset: TemplateForm["transitionPreset"];
  bgMode: TemplateForm["bgMode"]; defaultBgR2Key: string;
  userId: string | null;
}

function TemplateCard({ tpl, onEdit, onRemove }: {
  tpl: TemplateRow;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isShared = tpl.userId === null;
  const entry = getComposition(tpl.compositionId);
  const [hovered, setHovered] = useState(false);

  return (
    <div className="card flex flex-col gap-3 group hover:border-zinc-700 transition" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link to={`/templates/${tpl.id}`} className="block aspect-[9/16] -mx-4 -mt-4">
        <div className="aspect-[9/16] w-full overflow-hidden bg-zinc-950 border-b border-zinc-800 relative">
          {entry ? (
            <LivePlayer
              compositionId={tpl.compositionId}
              inputProps={tpl.compositionId === "SeedanceReel" ? { accent: tpl.accentColor } : {}}
              autoPlay={hovered}
              controls={false}
              loop
              rounded="rounded-none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
              {tpl.compositionId} 미등록
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1.5 pointer-events-none">
            <KindBadge kind={tpl.kind} />
          </div>
        </div>
      </Link>

      <div className="flex justify-between items-start gap-2">
        <Link to={`/templates/${tpl.id}`} className="flex-1 min-w-0">
          <div className="font-medium truncate group-hover:text-yellow-300 transition flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tpl.accentColor }} />
            <span className="truncate">{tpl.name}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 truncate">
            <code className="text-zinc-400">{tpl.slug}</code> · {tpl.compositionId} · {tpl.durationSec}s
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 bg-zinc-800 rounded">{tpl.bgMode === "ai" ? "AI bg" : "static bg"}</span>
            {isShared ? <span className="px-1.5 py-0.5 bg-zinc-800 rounded">공유</span> : null}
            {tpl.defaultAudioMood.slice(0, 3).map((m) => <span key={m} className="px-1.5 py-0.5 bg-zinc-800 rounded">{m}</span>)}
          </div>
        </Link>
        {!isShared ? (
          <div className="flex flex-col gap-1 shrink-0">
            <button className="btn btn-ghost text-xs" onClick={onEdit}>편집</button>
            <button className="btn btn-danger text-xs" onClick={onRemove}>삭제</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const style: Record<string, string> = {
    "reel-cards": "bg-blue-500/20 text-blue-200 border-blue-400/40",
    "reel-animated": "bg-purple-500/20 text-purple-200 border-purple-400/40",
    "reel-video": "bg-rose-500/20 text-rose-200 border-rose-400/40",
    "threads-photo": "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  };
  const cls = style[kind] ?? "bg-zinc-700/40 text-zinc-300 border-zinc-700";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border backdrop-blur-md ${cls}`}>{kind}</span>;
}

function toForm(t: TemplateRow): TemplateForm {
  return {
    slug: t.slug, name: t.name, kind: t.kind, platform: t.platform, compositionId: t.compositionId,
    schema: t.schema, defaults: t.defaults, defaultAudioMood: t.defaultAudioMood,
    durationSec: t.durationSec,
    accentColor: t.accentColor, bgPromptTemplate: t.bgPromptTemplate, transitionPreset: t.transitionPreset,
    bgMode: t.bgMode, defaultBgR2Key: t.defaultBgR2Key,
  };
}
