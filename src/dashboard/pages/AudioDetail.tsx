import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

interface Form {
  name: string;
  artist: string;
  source: "ncs" | "upload" | "suno";
  durationSec: number;
  bpm: number | undefined;
  moodTags: string[];
  licenseUrl: string;
  attributionText: string;
}

export function AudioDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <AudioDetailInner id={id} />;
}

function AudioDetailInner({ id }: { id: string }) {
  const detail = trpc.audio.get.useQuery({ id });
  const utils = trpc.useUtils();
  const toast = useToast();
  const navigate = useNavigate();

  const update = trpc.audio.update.useMutation({
    onSuccess: () => { utils.audio.get.invalidate({ id }); utils.audio.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.audio.remove.useMutation({
    onSuccess: () => { utils.audio.list.invalidate(); navigate("/audio"); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const presign = trpc.audio.presignUpload.useMutation();
  const replaceFile = trpc.audio.replaceFile.useMutation({
    onSuccess: () => { utils.audio.get.invalidate({ id }); toast({ tone: "ok", msg: "파일 교체 완료" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!detail.data) return;
    const t = detail.data.track;
    setForm({
      name: t.name,
      artist: t.artist ?? "",
      source: t.source,
      durationSec: t.durationSec,
      bpm: t.bpm ?? undefined,
      moodTags: t.moodTags ?? [],
      licenseUrl: t.licenseUrl ?? "",
      attributionText: t.attributionText ?? "",
    });
  }, [detail.data?.track?.id]);

  if (detail.isLoading || !form) return <Skeleton rows={3} height="h-32" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  if (!detail.data) return null;

  const t = detail.data.track;
  const isShared = detail.data.isShared;

  async function onReplace(file: File) {
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
      await replaceFile.mutateAsync({ id, r2Key, durationSec: Math.round(dur) });
    } catch (e) {
      toast({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link to="/audio" className="text-zinc-500 text-sm hover:text-zinc-300">← Audio Library</Link>
        <div className="flex items-end justify-between mt-2 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">{t.name}</h1>
            <div className="text-zinc-400 mt-1 text-sm">
              {t.artist ?? "—"} · {t.source} · {fmtDuration(t.durationSec)}
              {t.bpm ? ` · ${t.bpm}bpm` : ""}
              {isShared ? <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded text-xs">공유</span> : null}
            </div>
          </div>
          {!isShared ? (
            <button className="btn btn-danger" onClick={() => {
              if (confirm(`"${t.name}" 삭제?`)) remove.mutate({ id });
            }}>삭제</button>
          ) : null}
        </div>
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-400">미리듣기</h2>
        <audio controls preload="metadata" className="w-full" src={detail.data.publicUrl} />
        <div className="text-xs text-zinc-500 break-all">
          R2 key: <code className="text-zinc-300">{t.r2Key}</code>
        </div>
        {!isShared ? (
          <div className="flex items-center gap-2 pt-2">
            <input
              ref={fileInput}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(f); }}
            />
            <button className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? "업로드 중..." : "↑ 파일 교체"}
            </button>
            <span className="text-xs text-zinc-500">기존 R2 키는 삭제됩니다.</span>
          </div>
        ) : null}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-400">메타</h2>
        <fieldset disabled={isShared} className={isShared ? "opacity-60 pointer-events-none" : ""}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="아티스트">
              <input className="input" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
            </Field>
            <Field label="출처">
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as Form["source"] })}>
                <option value="ncs">NCS</option>
                <option value="upload">직접 업로드</option>
                <option value="suno">Suno</option>
              </select>
            </Field>
            <Field label="BPM">
              <input className="input" type="number" value={form.bpm ?? ""}
                onChange={(e) => setForm({ ...form, bpm: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="라이선스 URL">
              <input className="input" value={form.licenseUrl}
                onChange={(e) => setForm({ ...form, licenseUrl: e.target.value })} />
            </Field>
            <Field label="Mood 태그" hint="콤마 구분">
              <input className="input" value={form.moodTags.join(", ")}
                onChange={(e) => setForm({ ...form, moodTags: parseTags(e.target.value) })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Attribution 텍스트" hint="캡션 끝에 자동 첨부됨. NCS 트랙은 필수.">
              <input className="input" value={form.attributionText}
                onChange={(e) => setForm({ ...form, attributionText: e.target.value })} />
            </Field>
          </div>
          <div className="mt-5">
            <button className="btn btn-primary" disabled={update.isPending} onClick={() => {
              update.mutate({
                id,
                name: form.name,
                artist: form.artist || undefined,
                source: form.source,
                r2Key: t.r2Key,
                durationSec: form.durationSec,
                bpm: form.bpm,
                moodTags: form.moodTags,
                licenseUrl: form.licenseUrl || undefined,
                attributionText: form.attributionText || undefined,
              });
            }}>
              {update.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </fieldset>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">사용 이력 ({detail.data.usagePosts.length})</h2>
        {detail.data.usagePosts.length === 0 ? (
          <div className="text-sm text-zinc-500">아직 이 음원을 사용한 게시물이 없습니다.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {detail.data.usagePosts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-zinc-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500">{p.platform} · {p.publishedAt ? p.publishedAt.toLocaleString("ko-KR") : "—"}</div>
                  <div className="text-zinc-300 line-clamp-1 mt-0.5">{p.caption}</div>
                </div>
                {p.permalink ? (
                  <a className="text-xs text-yellow-300 shrink-0" href={p.permalink} target="_blank" rel="noreferrer">↗ 열기</a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseTags(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
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
