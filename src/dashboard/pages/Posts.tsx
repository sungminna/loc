import { trpc } from "../trpc";
import { Skeleton, Empty, ErrorBox } from "../components/States";

export function Posts() {
  const list = trpc.posts.list.useQuery({ limit: 100 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <p className="text-zinc-400 mt-1">자동 게시된 콘텐츠 이력.</p>
      </header>

      {list.isLoading ? <Skeleton rows={5} height="h-24" />
        : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} />
        : list.data?.length === 0 ? (
          <Empty
            icon="✦"
            title="아직 게시된 콘텐츠가 없습니다"
            hint="토픽 페이지에서 “지금 실행”을 눌러 첫 게시물을 만들어보세요."
          />
        ) : (
          <div className="space-y-3">
            {list.data?.map((p) => (
              <article key={p.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${badge(p.status)}`}>{p.status}</span>
                      <span className="text-xs text-zinc-500">{p.platform} · {p.mediaType} · {p.lang}</span>
                      {p.publishedAt ? (
                        <span className="text-xs text-zinc-500 ml-auto">
                          {p.publishedAt.toLocaleString("ko-KR")}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-zinc-300 line-clamp-3 whitespace-pre-line">{p.caption}</div>
                    {p.errorMessage ? <div className="text-xs text-red-400 mt-2">⚠ {p.errorMessage}</div> : null}
                    {p.permalink ? (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-3 text-xs text-yellow-300 hover:text-yellow-200 underline-offset-2 hover:underline"
                      >
                        ↗ {p.platform}에서 보기
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}

function badge(s: string): string {
  if (s === "published") return "bg-emerald-500/20 text-emerald-300";
  if (s === "failed") return "bg-red-500/20 text-red-300";
  return "bg-zinc-700/40 text-zinc-300";
}
