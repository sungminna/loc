import { useState } from "react";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { Skeleton, Empty, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

interface TemplateForm {
  slug: string;
  name: string;
  kind: "reel-cards" | "reel-animated" | "threads-photo";
  compositionId: string;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  defaultAudioMood: string[];
  durationSec: number;
}

const EMPTY: TemplateForm = {
  slug: "",
  name: "",
  kind: "reel-cards",
  compositionId: "CardNews",
  schema: {},
  defaults: {},
  defaultAudioMood: [],
  durationSec: 18,
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
          <div className="grid grid-cols-2 gap-3">
            {list.data?.map((t) => (
              <div key={t.id} className="card">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      <code className="text-zinc-400">{t.slug}</code> · {t.kind} · {t.compositionId} · {t.durationSec}s
                      {t.userId === null ? " · 공유" : ""}
                    </div>
                    {t.defaultAudioMood.length ? <div className="text-xs text-zinc-400 mt-1.5 flex flex-wrap gap-1">
                      {t.defaultAudioMood.map((m) => <span key={m} className="px-1.5 py-0.5 bg-zinc-800 rounded">{m}</span>)}
                    </div> : null}
                  </div>
                  {t.userId !== null ? (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button className="btn btn-ghost text-xs" onClick={() => setEditing({ id: t.id, form: toForm(t) })}>편집</button>
                      <button className="btn btn-danger text-xs" onClick={() => {
                        if (confirm(`"${t.name}" 삭제?`)) remove.mutate({ id: t.id });
                      }}>삭제</button>
                    </div>
                  ) : null}
                </div>
              </div>
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
        <Field label="종류">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TemplateForm["kind"] })}>
            <option value="reel-cards">Reel · Cards</option>
            <option value="reel-animated">Reel · Animated</option>
            <option value="threads-photo">Threads · Photo</option>
          </select>
        </Field>
        <Field label="Composition ID" hint="src/remotion/Root.tsx에 등록된 id">
          <input className="input font-mono text-xs" value={form.compositionId} onChange={(e) => setForm({ ...form, compositionId: e.target.value })} />
        </Field>
        <Field label="길이 (초)">
          <input className="input" type="number" min={3} max={90} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
        </Field>
        <Field label="기본 mood" hint="콤마 구분">
          <input className="input" value={form.defaultAudioMood.join(", ")}
            onChange={(e) => setForm({ ...form, defaultAudioMood: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
      </div>
    </div>
  );
}

interface TemplateRow {
  id: string; slug: string; name: string; kind: TemplateForm["kind"]; compositionId: string;
  schema: Record<string, unknown>; defaults: Record<string, unknown>;
  defaultAudioMood: string[]; durationSec: number;
}
function toForm(t: TemplateRow): TemplateForm {
  return {
    slug: t.slug, name: t.name, kind: t.kind, compositionId: t.compositionId,
    schema: t.schema, defaults: t.defaults, defaultAudioMood: t.defaultAudioMood,
    durationSec: t.durationSec,
  };
}
