import { Link } from "react-router-dom";
import { trpc } from "../trpc";
import { Skeleton } from "../components/States";

const ACTIVE_STATUSES = new Set([
  "planned", "researching", "planning", "generating", "rendering", "publishing",
]);

export function Overview() {
  const topics = trpc.topics.list.useQuery();
  const posts = trpc.posts.list.useQuery({ limit: 8 });
  const accounts = trpc.accounts.list.useQuery();
  // Larger window so the 7-day chart has data; refetch every 5s when something
  // is active so the dashboard feels live.
  const runs = trpc.runs.list.useQuery(
    { limit: 80 },
    {
      refetchInterval: (query) => {
        const data = query.state.data ?? [];
        return data.some((r) => ACTIVE_STATUSES.has(r.status)) ? 5000 : 30_000;
      },
    },
  );

  const isLoading = topics.isLoading || posts.isLoading || runs.isLoading;
  if (isLoading) {
    return (
      <div className="space-y-8">
        <header><h1 className="text-3xl font-bold tracking-tight">Overview</h1></header>
        <div className="grid grid-cols-4 gap-4"><Skeleton rows={1} height="h-24" /><Skeleton rows={1} height="h-24" /><Skeleton rows={1} height="h-24" /><Skeleton rows={1} height="h-24" /></div>
        <Skeleton rows={4} height="h-16" />
      </div>
    );
  }

  const enabledTopics = topics.data?.filter((t) => t.enabled).length ?? 0;
  const totalTopics = topics.data?.length ?? 0;
  const todayStart = startOfUtcDay();
  const sevenDaysAgo = todayStart - 6 * 86_400_000;
  const todayPosts = posts.data?.filter((p) => p.publishedAt && p.publishedAt.getTime() >= todayStart).length ?? 0;
  const accountCount = accounts.data?.length ?? 0;

  const recentRuns = runs.data ?? [];
  const activeRuns = recentRuns.filter((r) => ACTIVE_STATUSES.has(r.status));
  const failed24h = recentRuns.filter((r) => r.status === "failed" && r.createdAt.getTime() >= todayStart - 86_400_000).length;
  const totalCostMicros7d = recentRuns
    .filter((r) => r.createdAt.getTime() >= sevenDaysAgo)
    .reduce((s, r) => s + (r.costUsdMicros ?? 0), 0);

  // 7-day stacked bars by day for the cost trend.
  const dailyCost = Array.from({ length: 7 }, (_, i) => {
    const dayStart = todayStart - (6 - i) * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const ms = recentRuns
      .filter((r) => r.createdAt.getTime() >= dayStart && r.createdAt.getTime() < dayEnd)
      .reduce((s, r) => s + (r.costUsdMicros ?? 0), 0);
    return { dayStart, micros: ms };
  });
  const peakDailyMicros = Math.max(1, ...dailyCost.map((d) => d.micros));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-zinc-400 mt-1">자동 포스팅 운영 상태.</p>
        </div>
        {activeRuns.length ? (
          <div className="flex items-center gap-2 text-sm text-yellow-300">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
            진행 중 {activeRuns.length}건
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="활성 토픽" value={`${enabledTopics}/${totalTopics}`} link="/topics" />
        <Stat label="오늘 게시" value={todayPosts} link="/posts" />
        <Stat label="연결 계정" value={accountCount} link="/accounts" />
        <Stat label="24h 실패" value={failed24h} tone={failed24h > 0 ? "warn" : "ok"} link="/posts" />
      </div>

      {activeRuns.length > 0 ? (
        <section className="card border-yellow-500/30 bg-yellow-500/5">
          <h2 className="font-semibold mb-3 flex items-center justify-between">
            <span>실행 중</span>
            <span className="text-xs text-yellow-300/80 font-normal">5초마다 자동 갱신</span>
          </h2>
          <div className="text-sm divide-y divide-yellow-500/15">
            {activeRuns.map((r) => (
              <Link to={`/topics/${r.topicId}`} key={r.id} className="flex items-center justify-between py-2.5 hover:text-yellow-200">
                <div className="flex gap-3 items-center min-w-0">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-300 inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
                    {r.status}
                  </span>
                  <code className="text-zinc-400 text-xs">{r.id.slice(0, 8)}</code>
                </div>
                <div className="text-zinc-500 text-xs shrink-0">
                  {r.startedAt ? `시작 ${formatRel(r.startedAt)}` : "큐 대기"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="font-semibold mb-4 flex items-center justify-between">
          <span>최근 7일 비용</span>
          <span className="text-xs text-zinc-500 font-normal">합계 ${(totalCostMicros7d / 1_000_000).toFixed(2)}</span>
        </h2>
        <div className="grid grid-cols-7 gap-1 items-end h-24">
          {dailyCost.map((d, i) => {
            const h = (d.micros / peakDailyMicros) * 100;
            const isToday = i === 6;
            return (
              <div key={d.dayStart} className="flex flex-col items-center justify-end h-full gap-1.5">
                <div
                  className={`w-full rounded-t ${isToday ? "bg-yellow-300" : "bg-zinc-700"}`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`$${(d.micros / 1_000_000).toFixed(3)}`}
                />
                <div className="text-[10px] text-zinc-500">{new Date(d.dayStart).toLocaleDateString("ko-KR", { weekday: "short" })[0]}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-4">최근 실행</h2>
        {recentRuns.length ? (
          <div className="text-sm divide-y divide-zinc-800">
            {recentRuns.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <div className="flex gap-3 items-center min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${badgeTone(r.status)}`}>{r.status}</span>
                  <code className="text-zinc-400 text-xs">{r.id.slice(0, 8)}</code>
                  {r.error ? <span className="text-xs text-red-400 truncate max-w-md">{r.error}</span> : null}
                </div>
                <div className="text-zinc-500 text-xs shrink-0">
                  ${((r.costUsdMicros ?? 0) / 1_000_000).toFixed(3)} · {r.createdAt ? formatRel(r.createdAt) : "-"}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-zinc-500 text-sm">아직 실행 내역이 없습니다.</div>}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-4">최근 게시</h2>
        {posts.data?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {posts.data.map((p) => (
              <div key={p.id} className="border border-zinc-800 rounded-lg p-3">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{p.platform}</span>
                  <span className="text-zinc-500">{p.lang}</span>
                </div>
                <div className="text-zinc-400 mt-1.5 line-clamp-2 text-sm">{p.caption}</div>
                {p.permalink ? (
                  <a className="text-xs text-yellow-300 mt-2 inline-block" href={p.permalink} target="_blank" rel="noreferrer">↗ 열기</a>
                ) : null}
              </div>
            ))}
          </div>
        ) : <div className="text-zinc-500 text-sm">아직 게시물이 없습니다.</div>}
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "ok", link }: { label: string; value: number | string; tone?: "ok" | "warn"; link?: string }) {
  const inner = (
    <div className="card hover:border-zinc-700 transition">
      <div className="label">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${tone === "warn" ? "text-amber-300" : ""}`}>{value}</div>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function badgeTone(s: string): string {
  if (s === "done") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  if (s === "publishing" || s === "rendering" || s === "generating") return "bg-yellow-500/20 text-yellow-300";
  return "bg-zinc-700/40 text-zinc-300";
}

function startOfUtcDay(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function formatRel(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "방금";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}시간 전`;
  return d.toLocaleDateString("ko-KR");
}
