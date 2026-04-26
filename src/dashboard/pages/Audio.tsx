import { useState, useRef } from "react";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { Skeleton, Empty, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

interface TrackForm {
  name: string;
  artist?: string;
  source: "ncs" | "upload" | "suno";
  r2Key: string;
  durationSec: number;
  bpm?: number;
  moodTags: string[];
  licenseUrl?: string;
  attributionText?: string;
}

const EMPTY: TrackForm = {
  name: "",
  artist: "",
  source: "ncs",
  r2Key: "",
  durationSec: 120,
  moodTags: [],
  attributionText: "",
};

export function Audio() {
  const list = trpc.audio.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const create = trpc.audio.create.useMutation({
    onSuccess: () => { utils.audio.list.invalidate(); toast({ tone: "ok", msg: "트랙 추가됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const update = trpc.audio.update.useMutation({
    onSuccess: () => { utils.audio.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.audio.remove.useMutation({
    onSuccess: () => { utils.audio.list.invalidate(); toast({ tone: "ok", msg: "삭제됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const presign = trpc.audio.presignUpload.useMutation();

  const [editing, setEditing] = useState<{ id?: string; form: TrackForm } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const { r2Key, uploadUrl } = await presign.mutateAsync({ filename: file.name });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "audio/mpeg" },
        body: file,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
      const dur = await probeDuration(file);
      setEditing({
        form: {
          ...EMPTY,
          source: "upload",
          name: file.name.replace(/\.[^.]+$/, ""),
          r2Key,
          durationSec: Math.round(dur),
        },
      });
      toast({ tone: "ok", msg: "업로드 완료. 메타 입력 후 저장하세요." });
    } catch (e) {
      toast({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audio Library</h1>
          <p className="text-zinc-400 mt-1">릴스 BGM. NCS 트랙 시드 + 직접 업로드.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
          <button className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? "업로드 중..." : "↑ 파일 업로드"}
          </button>
          <button className="btn btn-primary" onClick={() => setEditing({ form: { ...EMPTY } })}>+ 수동 추가</button>
        </div>
      </header>

      {list.isLoading ? <Skeleton rows={4} height="h-20" />
        : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} />
        : list.data?.length === 0 ? (
          <Empty
            icon="♪"
            title="음원이 없습니다"
            hint="NCS(NoCopyrightSounds)에서 다운받아 직접 업로드하거나, R2에 직접 올린 키를 등록하세요."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {list.data?.map((t) => (
              <div key={t.id} className="card">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {t.artist ?? "—"} · {t.source} · {fmtDuration(t.durationSec)}
                      {t.bpm ? ` · ${t.bpm}bpm` : ""}
                      {t.userId === null ? " · 공유" : ""}
                    </div>
                    {t.moodTags.length ? <div className="text-xs text-zinc-400 mt-1.5 flex flex-wrap gap-1">
                      {t.moodTags.map((m) => <span key={m} className="px-1.5 py-0.5 bg-zinc-800 rounded">{m}</span>)}
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
        title={editing?.id ? "트랙 편집" : "트랙 추가"}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>취소</button>
            <button
              className="btn btn-primary"
              disabled={!editing?.form.name || !editing?.form.r2Key}
              onClick={() => {
                if (!editing) return;
                const action = editing.id
                  ? update.mutateAsync({ id: editing.id, ...editing.form })
                  : create.mutateAsync(editing.form);
                action.then(() => setEditing(null)).catch(() => {});
              }}
            >
              {editing?.id ? "저장" : "추가"}
            </button>
          </>
        }
      >
        {editing && <TrackEditor form={editing.form} setForm={(f) => setEditing({ ...editing, form: f })} />}
      </Modal>
    </div>
  );
}

function TrackEditor({ form, setForm }: { form: TrackForm; setForm: (f: TrackForm) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="아티스트"><input className="input" value={form.artist ?? ""} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></Field>
        <Field label="출처">
          <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as TrackForm["source"] })}>
            <option value="ncs">NCS</option>
            <option value="upload">직접 업로드</option>
            <option value="suno">Suno</option>
          </select>
        </Field>
        <Field label="길이 (초)" error={form.durationSec <= 0 ? "필수" : undefined}>
          <input className="input" type="number" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="R2 key" hint="예: audio/u-<id>/foo.mp3 또는 audio/ncs/heroes-tonight.mp3">
        <input className="input font-mono text-xs" value={form.r2Key} onChange={(e) => setForm({ ...form, r2Key: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="BPM (선택)">
          <input className="input" type="number" value={form.bpm ?? ""} onChange={(e) => setForm({ ...form, bpm: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
        <Field label="라이선스 URL (선택)">
          <input className="input" value={form.licenseUrl ?? ""} onChange={(e) => setForm({ ...form, licenseUrl: e.target.value })} />
        </Field>
      </div>
      <Field label="Mood 태그" hint="콤마 구분">
        <input className="input" value={form.moodTags.join(", ")}
          onChange={(e) => setForm({ ...form, moodTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Attribution 텍스트" hint="캡션 끝에 자동 첨부됨. NCS 트랙은 필수.">
        <input className="input" value={form.attributionText ?? ""}
          onChange={(e) => setForm({ ...form, attributionText: e.target.value })}
          placeholder='Music: "Heroes Tonight" by Janji feat. Johnning [NCS]' />
      </Field>
    </div>
  );
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface TrackRow {
  id: string; userId: string | null; name: string; artist: string | null; source: "ncs" | "upload" | "suno";
  r2Key: string; durationSec: number; bpm: number | null; moodTags: string[];
  licenseUrl: string | null; attributionText: string | null;
}
function toForm(t: TrackRow): TrackForm {
  return {
    name: t.name, artist: t.artist ?? "", source: t.source, r2Key: t.r2Key,
    durationSec: t.durationSec, bpm: t.bpm ?? undefined, moodTags: t.moodTags,
    licenseUrl: t.licenseUrl ?? "", attributionText: t.attributionText ?? "",
  };
}

async function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = new window.Audio();
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(isFinite(el.duration) ? el.duration : 120);
    el.onerror = () => resolve(120);
    el.src = URL.createObjectURL(file);
  });
}
