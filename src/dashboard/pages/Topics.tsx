import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import cronstrue from "cronstrue";
import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { Skeleton, Empty, ErrorBox } from "../components/States";
import { Field } from "../components/Field";

interface TopicForm {
  name: string;
  description?: string;
  lang: "ko" | "en" | "ko+en";
  personaPrompt: string;
  sourceUrls: string[];
  targetAccounts: { instagram?: string; threads?: string };
  templateSlugs: string[];
  audioPrefs: { moodTags?: string[]; allowedSources?: ("ncs" | "upload" | "suno")[]; fixedTrackId?: string };
  cron: string;
  dailyRunCap: number;
  costCapUsd: number;
  enabled: boolean;
  imageMode: "ai-all" | "ai-first-only" | "template-only";
  threadsFormat: "text" | "image";
  hashtagMode: "ai" | "fixed" | "mixed";
  fixedHashtags: string[];
}

const DEFAULT: TopicForm = {
  name: "",
  description: "",
  lang: "ko",
  personaPrompt: "",
  sourceUrls: [],
  targetAccounts: {},
  templateSlugs: [],
  audioPrefs: { moodTags: [], allowedSources: ["ncs", "upload"] },
  cron: "0 9 * * *",
  dailyRunCap: 1,
  costCapUsd: 5,
  enabled: true,
  imageMode: "ai-first-only",
  threadsFormat: "image",
  hashtagMode: "ai",
  fixedHashtags: [],
};

// Statuses that mean a sandbox is currently running for the topic. Drives
// the "running now" pill + the auto-refresh interval.
const ACTIVE_STATUSES = new Set(["planned", "researching", "planning", "generating", "rendering", "publishing"]);

export function Topics() {
  const list = trpc.topics.list.useQuery();
  const accounts = trpc.accounts.list.useQuery();
  const templates = trpc.templates.list.useQuery();
  // Refetch recent runs every 5s so the running-now badge stays current
  // without an in-page subscription. Bounded `limit: 50` keeps it cheap.
  const recentRuns = trpc.runs.list.useQuery(
    { limit: 50 },
    { refetchInterval: 5000 },
  );
  const utils = trpc.useUtils();
  const toast = useToast();

  const activeByTopic = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recentRuns.data ?? []) {
      if (!ACTIVE_STATUSES.has(r.status)) continue;
      if (!m.has(r.topicId)) m.set(r.topicId, r.status);
    }
    return m;
  }, [recentRuns.data]);

  const create = trpc.topics.create.useMutation({
    onSuccess: () => { utils.topics.list.invalidate(); toast({ tone: "ok", msg: "토픽 추가됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const update = trpc.topics.update.useMutation({
    onSuccess: () => { utils.topics.list.invalidate(); toast({ tone: "ok", msg: "저장됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const remove = trpc.topics.remove.useMutation({
    onSuccess: () => { utils.topics.list.invalidate(); toast({ tone: "ok", msg: "삭제됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });
  const runNow = trpc.topics.runNow.useMutation({
    onSuccess: ({ runId }) => toast({ tone: "ok", msg: `실행 큐에 추가됨 (${runId.slice(0, 8)}...)` }),
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const [editing, setEditing] = useState<{ id?: string; form: TopicForm } | null>(null);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-zinc-400 mt-1">매 토픽마다 자동으로 콘텐츠를 생성·게시합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ form: { ...DEFAULT } })}>
          + 새 토픽
        </button>
      </header>

      {list.isLoading ? <Skeleton rows={3} height="h-24" />
        : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} />
        : list.data?.length === 0 ? (
          <Empty
            icon="◆"
            title="아직 토픽이 없습니다"
            hint="토픽을 추가하면 cron 일정에 따라 Claude Code가 자동으로 콘텐츠를 만들어 게시합니다."
            cta={<button className="btn btn-primary" onClick={() => setEditing({ form: { ...DEFAULT } })}>첫 토픽 만들기</button>}
          />
        )
        : (
          <div className="space-y-3">
            {list.data?.map((t) => {
              const activeStatus = activeByTopic.get(t.id);
              return (
              <div key={t.id} className="card flex items-center justify-between">
                <Link to={`/topics/${t.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    <span className="font-medium group-hover:text-yellow-300 transition">{t.name}</span>
                    <span className="text-zinc-500 text-xs uppercase">{t.lang}</span>
                    {activeStatus ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse mr-1.5 align-middle" />
                        {activeStatus} 중
                      </span>
                    ) : null}
                    {t.useDraftForNext ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30">초안 사용</span>
                    ) : null}
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">{safeCron(t.cron)} · 다음 {fmtNextRun(t.nextRunAt, t.enabled)}</div>
                  <div className="text-zinc-500 text-xs">소스 {t.sourceUrls.length} · 템플릿 {t.templateSlugs.join(",") || "—"} · 일일 {t.dailyRunCap}회 · ${t.costCapUsd} 상한</div>
                </Link>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button className="btn btn-ghost" disabled={runNow.isPending || !!activeStatus} onClick={() => runNow.mutate({ id: t.id })}>
                    {activeStatus ? "실행 중" : "지금 실행"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditing({ id: t.id, form: toForm(t) })}>편집</button>
                  <button className="btn btn-danger" onClick={() => {
                    if (confirm(`"${t.name}" 토픽을 삭제할까요? 관련 실행 이력도 모두 삭제됩니다.`)) remove.mutate({ id: t.id });
                  }}>삭제</button>
                </div>
              </div>
              );
            })}
          </div>
        )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "토픽 편집" : "새 토픽"}
        width="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>취소</button>
            <button
              className="btn btn-primary"
              disabled={!editing?.form.name || create.isPending || update.isPending}
              onClick={() => {
                if (!editing) return;
                const action = editing.id
                  ? update.mutateAsync({ id: editing.id, ...editing.form })
                  : create.mutateAsync(editing.form);
                action.then(() => setEditing(null)).catch(() => {/* toast handles */});
              }}
            >
              {editing?.id ? "저장" : "추가"}
            </button>
          </>
        }
      >
        {editing && (
          <TopicEditor
            form={editing.form}
            setForm={(f) => setEditing({ ...editing, form: f })}
            accounts={accounts.data ?? []}
            templates={templates.data ?? []}
          />
        )}
      </Modal>
    </div>
  );
}

interface AccountLite { id: string; platform: "instagram" | "threads"; handle: string }
interface TemplateLite { id: string; slug: string; name: string }

function TopicEditor({ form, setForm, accounts, templates }: {
  form: TopicForm;
  setForm: (f: TopicForm) => void;
  accounts: AccountLite[];
  templates: TemplateLite[];
}) {
  return (
    <div className="space-y-4">
      <Field label="이름" error={!form.name ? "필수" : undefined}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: AI 생산성" />
      </Field>
      <Field label="설명" hint="대시보드에서만 보이는 메모">
        <input className="input" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="언어">
          <select className="input" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as TopicForm["lang"] })}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ko+en">한국어 + English</option>
          </select>
        </Field>
        <Field label="cron" error={cronError(form.cron)} hint={cronError(form.cron) ? undefined : safeCron(form.cron)}>
          <input className="input font-mono text-xs" value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} />
        </Field>
      </div>
      <Field label="페르소나 프롬프트" hint="브랜드 톤 / 시점. content-plan 스킬이 이걸 기준으로 카피 톤을 잡습니다.">
        <textarea className="input min-h-24" value={form.personaPrompt} onChange={(e) => setForm({ ...form, personaPrompt: e.target.value })} />
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
            {accounts.filter((a) => a.platform === "instagram").map((a) => <option key={a.id} value={a.id}>@{a.handle}</option>)}
          </select>
        </Field>
        <Field label="Threads 계정">
          <select className="input" value={form.targetAccounts.threads ?? ""}
            onChange={(e) => setForm({ ...form, targetAccounts: { ...form.targetAccounts, threads: e.target.value || undefined } })}>
            <option value="">— 미사용 —</option>
            {accounts.filter((a) => a.platform === "threads").map((a) => <option key={a.id} value={a.id}>@{a.handle}</option>)}
          </select>
        </Field>
      </div>
      <Field label="템플릿">
        <select className="input" value={form.templateSlugs[0] ?? ""}
          onChange={(e) => setForm({ ...form, templateSlugs: e.target.value ? [e.target.value] : [] })}>
          <option value="">— 기본 —</option>
          {templates.map((t) => <option key={t.id} value={t.slug}>{t.name} ({t.slug})</option>)}
        </select>
      </Field>
      <Field label="음원 mood" hint="콤마 구분. 예: uplifting, minimal">
        <input className="input" value={(form.audioPrefs.moodTags ?? []).join(", ")}
          onChange={(e) => setForm({ ...form, audioPrefs: { ...form.audioPrefs, moodTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="이미지 자동화" hint="AI가 슬라이드 배경을 얼마나 자율적으로 만들지">
          <select className="input" value={form.imageMode}
            onChange={(e) => setForm({ ...form, imageMode: e.target.value as TopicForm["imageMode"] })}>
            <option value="ai-all">AI 전체 자동 생성</option>
            <option value="ai-first-only">첫 슬라이드만 AI · 나머지 템플릿</option>
            <option value="template-only">템플릿 기본 이미지만 사용</option>
          </select>
        </Field>
        <Field label="Threads 포맷" hint="text = 글만, image = ThreadsCard 이미지+글">
          <select className="input" value={form.threadsFormat}
            onChange={(e) => setForm({ ...form, threadsFormat: e.target.value as TopicForm["threadsFormat"] })}>
            <option value="image">이미지 + 글</option>
            <option value="text">글만</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="해시태그 모드" hint="ai = AI가 매번 생성. fixed = 고정 태그만. mixed = 둘 다 합쳐서.">
          <select className="input" value={form.hashtagMode}
            onChange={(e) => setForm({ ...form, hashtagMode: e.target.value as TopicForm["hashtagMode"] })}>
            <option value="ai">AI 자동 생성</option>
            <option value="fixed">고정만</option>
            <option value="mixed">AI + 고정 합쳐서</option>
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
        <Field label="일일 실행 상한" hint="회 / 24h">
          <input className="input" type="number" min={1} max={20} value={form.dailyRunCap}
            onChange={(e) => setForm({ ...form, dailyRunCap: Math.max(1, Number(e.target.value)) })} />
        </Field>
        <Field label="회당 비용 상한" hint="USD">
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
    </div>
  );
}

function safeCron(s: string): string {
  try { return cronstrue.toString(s, { locale: "ko" }); } catch { return "유효하지 않은 cron"; }
}

function fmtNextRun(d: Date | null | undefined, enabled: boolean): string {
  if (!enabled) return "비활성";
  if (!d) return "곧";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "큐 대기";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분 뒤`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 뒤`;
  return d.toLocaleString("ko-KR");
}
function cronError(s: string): string | undefined {
  try { cronstrue.toString(s); return undefined; } catch { return "잘못된 cron 표현식"; }
}
function toForm(t: {
  id: string;
  name: string;
  description?: string | null;
  lang: "ko" | "en" | "ko+en";
  personaPrompt: string;
  sourceUrls: string[];
  targetAccounts: { instagram?: string; threads?: string };
  templateSlugs: string[];
  audioPrefs: TopicForm["audioPrefs"];
  cron: string;
  dailyRunCap: number;
  costCapUsd: number;
  enabled: boolean;
  imageMode?: TopicForm["imageMode"];
  threadsFormat?: TopicForm["threadsFormat"];
  hashtagMode?: TopicForm["hashtagMode"];
  fixedHashtags?: string[];
}): TopicForm {
  return {
    name: t.name,
    description: t.description ?? "",
    lang: t.lang,
    personaPrompt: t.personaPrompt,
    sourceUrls: t.sourceUrls,
    targetAccounts: t.targetAccounts,
    templateSlugs: t.templateSlugs,
    audioPrefs: t.audioPrefs ?? {},
    cron: t.cron,
    dailyRunCap: t.dailyRunCap,
    costCapUsd: t.costCapUsd,
    enabled: t.enabled,
    imageMode: t.imageMode ?? "ai-first-only",
    threadsFormat: t.threadsFormat ?? "image",
    hashtagMode: t.hashtagMode ?? "ai",
    fixedHashtags: t.fixedHashtags ?? [],
  };
}

export { safeCron };
