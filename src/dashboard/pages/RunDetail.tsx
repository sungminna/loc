import { Link, useParams } from "react-router-dom";
import { trpc } from "../trpc";
import { Skeleton, ErrorBox } from "../components/States";
import { useToast } from "../components/Toast";

const ACTIVE = new Set(["planned", "researching", "planning", "generating", "rendering", "publishing"]);

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <RunDetailInner id={id} />;
}

function RunDetailInner({ id }: { id: string }) {
  const detail = trpc.runs.get.useQuery(
    { id },
    {
      refetchInterval: (q) => (q.state.data && ACTIVE.has(q.state.data.run.status) ? 5000 : false),
    },
  );
  const utils = trpc.useUtils();
  const toast = useToast();

  const publishIg = trpc.runs.publishInstagram.useMutation({
    onSuccess: (r) => { toast({ tone: "ok", msg: `Instagram 게시 완료 · ${r.permalink}` }); utils.runs.get.invalidate({ id }); },
    onError: (e) => toast({ tone: "err", msg: `Instagram 게시 실패: ${e.message}` }),
  });
  const publishThreads = trpc.runs.publishThreads.useMutation({
    onSuccess: (r) => { toast({ tone: "ok", msg: `Threads 게시 완료 · ${r.permalink}` }); utils.runs.get.invalidate({ id }); },
    onError: (e) => toast({ tone: "err", msg: `Threads 게시 실패: ${e.message}` }),
  });
  const retry = trpc.runs.retryPost.useMutation({
    onSuccess: () => { toast({ tone: "ok", msg: "재시도 완료" }); utils.runs.get.invalidate({ id }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  if (detail.isLoading) return <Skeleton rows={4} height="h-32" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  if (!detail.data) return null;

  const { run, assets, posts, topic, publicMediaBase } = detail.data;
  const reel = assets.find((a) => a.kind === "reel-mp4");
  const cover = assets.find((a) => a.kind === "thumb");
  const threadsImg = assets.find((a) => a.kind === "threads-jpg");
  const slideBgs = assets.filter((a) => a.kind === "image-bg" || a.kind === "video-frame");
  const seedanceClips = assets.filter((a) => a.kind === "seedance-mp4");

  const igPost = posts.find((p) => p.platform === "instagram");
  const threadsPost = posts.find((p) => p.platform === "threads");
  const igAccountId = topic?.targetAccounts?.instagram;
  const threadsAccountId = topic?.targetAccounts?.threads;
  // Manual publish must wait until the sandbox-side pipeline is finished —
  // otherwise a click during `publishing` races the orchestrator and creates
  // a duplicate IG/Threads post. Mirrors the server-side guard.
  const runInFlight = ACTIVE.has(run.status);

  return (
    <div className="space-y-6">
      <header>
        <Link to={topic ? `/topics/${topic.id}` : "/"} className="text-zinc-500 text-sm hover:text-zinc-300">
          ← {topic ? topic.name : "Overview"}
        </Link>
        <div className="flex items-end justify-between mt-2 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">실행 상세</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs ${badge(run.status)}`}>{run.status}</span>
              {ACTIVE.has(run.status) ? (
                <span className="text-xs text-yellow-300 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" /> 진행 중
                </span>
              ) : null}
            </div>
            <div className="text-zinc-500 text-xs mt-1 font-mono">{run.id}</div>
          </div>
          <div className="text-xs text-zinc-500 text-right">
            <div>${(run.costUsdMicros / 1_000_000).toFixed(3)} · {(run.tokensIn + run.tokensOut).toLocaleString()} tokens</div>
            <div>시작 {run.startedAt?.toLocaleString("ko-KR") ?? "-"}</div>
            <div>종료 {run.finishedAt?.toLocaleString("ko-KR") ?? "-"}</div>
          </div>
        </div>
      </header>

      {run.error ? (
        <div className="card border-red-500/40 bg-red-500/5">
          <div className="text-red-300 font-medium text-sm">실행 오류</div>
          <pre className="text-zinc-300 text-xs mt-2 whitespace-pre-wrap break-words">{run.error}</pre>
        </div>
      ) : null}

      {/* ─── Publish actions ─────────────────────────────── */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">수동 게시</h2>
          <span className="text-xs text-zinc-500">자동 게시가 실패했거나 토픽에서 미실행됐을 때 직접 업로드</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <PublishCard
            label="Instagram Reels"
            accountConfigured={Boolean(igAccountId)}
            assetReady={Boolean(reel)}
            assetHint={reel ? `reel.mp4 · ${humanBytes(reel.bytes)}` : "reel-mp4 자산 없음 — 렌더가 끝나지 않았습니다"}
            post={igPost}
            running={publishIg.isPending}
            runInFlight={runInFlight}
            runStatus={run.status}
            onPublish={() => publishIg.mutate({ runId: run.id })}
            onRetry={igPost ? () => retry.mutate({ postId: igPost.id }) : undefined}
          />
          <PublishCard
            label="Threads"
            accountConfigured={Boolean(threadsAccountId)}
            assetReady={topic?.threadsFormat === "text" ? true : Boolean(threadsImg)}
            assetHint={
              topic?.threadsFormat === "text"
                ? "텍스트 전용 모드 — 이미지 없이 게시"
                : threadsImg ? `threads.jpg · ${humanBytes(threadsImg.bytes)}` : "threads-jpg 자산 없음 (텍스트 전용으로 변경하면 게시 가능)"
            }
            post={threadsPost}
            running={publishThreads.isPending}
            runInFlight={runInFlight}
            runStatus={run.status}
            onPublish={() => publishThreads.mutate({ runId: run.id })}
            onRetry={threadsPost ? () => retry.mutate({ postId: threadsPost.id }) : undefined}
          />
        </div>
      </section>

      {/* ─── Final assets preview ────────────────────────── */}
      {(reel || threadsImg) ? (
        <section className="card space-y-3">
          <h2 className="font-semibold">렌더 결과물</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {reel ? (
              <div>
                <div className="label mb-2">Instagram Reel</div>
                <video
                  controls
                  src={`${publicMediaBase}/${reel.r2Key}`}
                  poster={cover ? `${publicMediaBase}/${cover.r2Key}` : undefined}
                  className="w-full max-w-xs aspect-[9/16] bg-black rounded-lg"
                />
                <div className="mt-2 flex gap-3 text-xs">
                  <a className="text-yellow-300 hover:text-yellow-200" href={`${publicMediaBase}/${reel.r2Key}`} target="_blank" rel="noreferrer">↗ MP4 다운로드</a>
                  {cover ? <a className="text-yellow-300 hover:text-yellow-200" href={`${publicMediaBase}/${cover.r2Key}`} target="_blank" rel="noreferrer">↗ Cover JPG</a> : null}
                </div>
              </div>
            ) : null}
            {threadsImg ? (
              <div>
                <div className="label mb-2">Threads Image</div>
                <img
                  src={`${publicMediaBase}/${threadsImg.r2Key}`}
                  alt="Threads card"
                  className="w-full max-w-xs aspect-[4/5] object-cover rounded-lg border border-zinc-800"
                />
                <a className="text-yellow-300 hover:text-yellow-200 text-xs inline-block mt-2" href={`${publicMediaBase}/${threadsImg.r2Key}`} target="_blank" rel="noreferrer">↗ JPG 다운로드</a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ─── Brief summary ────────────────────────────────── */}
      <BriefCard brief={run.briefJson} />

      {/* ─── Slide / scene assets ─────────────────────────── */}
      {slideBgs.length > 0 ? (
        <section className="card">
          <h2 className="font-semibold mb-3">생성된 이미지 ({slideBgs.length})</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {slideBgs.map((a) => (
              <a key={a.id} href={`${publicMediaBase}/${a.r2Key}`} target="_blank" rel="noreferrer" className="block">
                <img src={`${publicMediaBase}/${a.r2Key}`} alt="" className="aspect-[2/3] object-cover w-full rounded border border-zinc-800 hover:border-zinc-600 transition" />
                <div className="text-[10px] text-zinc-500 mt-1 truncate">{a.kind}</div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {seedanceClips.length > 0 ? (
        <section className="card">
          <h2 className="font-semibold mb-3">씬 영상 클립 ({seedanceClips.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {seedanceClips.map((a) => (
              <video key={a.id} controls src={`${publicMediaBase}/${a.r2Key}`} className="w-full aspect-[9/16] bg-black rounded" />
            ))}
          </div>
        </section>
      ) : null}

      {/* ─── Posts list (raw) ─────────────────────────────── */}
      {posts.length > 0 ? (
        <section className="card">
          <h2 className="font-semibold mb-3">게시 이력 ({posts.length})</h2>
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="border border-zinc-800 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${postBadge(p.status)}`}>{p.status}</span>
                    <span className="text-xs text-zinc-400">{p.platform} · {p.mediaType}</span>
                    {p.publishedAt ? <span className="text-xs text-zinc-500">{p.publishedAt.toLocaleString("ko-KR")}</span> : null}
                  </div>
                  {p.permalink ? (
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="text-xs text-yellow-300 hover:text-yellow-200">↗ 열기</a>
                  ) : null}
                </div>
                <div className="text-zinc-300 text-sm mt-2 whitespace-pre-line line-clamp-4">{p.caption}</div>
                {p.errorMessage ? <div className="text-xs text-red-400 mt-2 break-all">⚠ {p.errorMessage}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PublishCard({
  label, accountConfigured, assetReady, assetHint, post, running, runInFlight, runStatus, onPublish, onRetry,
}: {
  label: string;
  accountConfigured: boolean;
  assetReady: boolean;
  assetHint: string;
  post: { id: string; status: string; permalink: string | null; errorMessage: string | null } | undefined;
  running: boolean;
  runInFlight: boolean;
  runStatus: string;
  onPublish: () => void;
  onRetry?: () => void;
}) {
  const blocked = !accountConfigured || !assetReady || runInFlight;
  const isPublished = post?.status === "published";
  const hint = !accountConfigured
    ? "토픽에 계정이 연결되어 있지 않습니다"
    : runInFlight
      ? `샌드박스가 진행 중입니다 (${runStatus}) — 끝난 뒤 다시 시도하세요`
      : assetHint;
  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{label}</div>
        {post ? <span className={`px-2 py-0.5 rounded text-xs ${postBadge(post.status)}`}>{post.status}</span> : null}
      </div>
      <div className="text-xs text-zinc-500">{hint}</div>
      {post?.errorMessage ? <div className="text-xs text-red-400 break-all">⚠ {post.errorMessage}</div> : null}
      {post?.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer" className="text-xs text-yellow-300 inline-block">↗ 게시물 열기</a> : null}
      <div className="flex justify-end gap-2">
        {isPublished ? (
          <span className="text-xs text-emerald-400 self-center">이미 게시됨</span>
        ) : post && onRetry ? (
          <button className="btn btn-primary" onClick={onRetry} disabled={blocked || running}>
            {running ? "재시도 중..." : "다시 시도"}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onPublish} disabled={blocked || running}>
            {running ? "게시 중..." : "지금 게시"}
          </button>
        )}
      </div>
    </div>
  );
}

function BriefCard({ brief }: { brief: unknown }) {
  if (!brief || typeof brief !== "object") {
    return (
      <section className="card">
        <h2 className="font-semibold mb-2">Brief</h2>
        <div className="text-sm text-zinc-500">Brief가 아직 저장되지 않았습니다 (planning 단계 미완료).</div>
      </section>
    );
  }
  const b = brief as Record<string, unknown>;
  const igCaption = (b.caption as Record<string, unknown> | undefined)?.instagram as string | undefined;
  const threadsText = ((b.threads as Record<string, unknown> | undefined)?.text as string | undefined)
    ?? ((b.caption as Record<string, unknown> | undefined)?.threads as string | undefined);
  const hashtags = (b.hashtags as string[] | undefined) ?? [];
  const slides = (b.slides as Array<Record<string, unknown>> | undefined) ?? [];
  const scenes = (((b.video as Record<string, unknown> | undefined)?.scenes) as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Brief</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="label mb-1">Instagram caption</div>
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words bg-zinc-900/40 rounded p-2 max-h-40 overflow-auto">
            {igCaption ?? "(없음)"}
          </pre>
        </div>
        <div>
          <div className="label mb-1">Threads text</div>
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words bg-zinc-900/40 rounded p-2 max-h-40 overflow-auto">
            {threadsText ?? "(없음)"}
          </pre>
        </div>
      </div>
      {hashtags.length > 0 ? (
        <div>
          <div className="label mb-1">Hashtags ({hashtags.length})</div>
          <div className="text-xs text-zinc-300">{hashtags.map((h) => `#${h}`).join(" ")}</div>
        </div>
      ) : null}
      {slides.length > 0 ? (
        <details>
          <summary className="text-sm cursor-pointer text-zinc-400">슬라이드 ({slides.length})</summary>
          <ol className="text-xs text-zinc-300 list-decimal pl-5 space-y-1 mt-2">
            {slides.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{(s.headline as string) ?? "(no headline)"}</span>
                {s.body ? <span className="text-zinc-500"> · {String(s.body).slice(0, 80)}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {scenes.length > 0 ? (
        <details>
          <summary className="text-sm cursor-pointer text-zinc-400">씬 ({scenes.length})</summary>
          <ol className="text-xs text-zinc-300 list-decimal pl-5 space-y-1 mt-2">
            {scenes.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{(s.chapter as string) ?? (s.kicker as string) ?? `scene ${i + 1}`}</span>
                {s.headline ? <span className="text-zinc-500"> · {String(s.headline)}</span> : null}
                {s.durationSec ? <span className="text-zinc-600"> · {String(s.durationSec)}s</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <details>
        <summary className="text-xs text-zinc-500 cursor-pointer">raw JSON</summary>
        <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap break-words bg-zinc-900/40 rounded p-2 max-h-80 overflow-auto mt-2">
          {JSON.stringify(brief, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function badge(s: string): string {
  if (s === "done") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  if (s === "publishing" || s === "rendering" || s === "generating") return "bg-yellow-500/20 text-yellow-300";
  return "bg-zinc-700/40 text-zinc-300";
}
function postBadge(s: string): string {
  if (s === "published") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  return "bg-zinc-700/40 text-zinc-300";
}
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
