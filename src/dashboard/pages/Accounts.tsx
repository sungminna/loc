import { trpc } from "../trpc";
import { useToast } from "../components/Toast";
import { Skeleton, Empty, ErrorBox } from "../components/States";

export function Accounts() {
  const list = trpc.accounts.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const remove = trpc.accounts.remove.useMutation({
    onSuccess: () => { utils.accounts.list.invalidate(); toast({ tone: "ok", msg: "계정 제거됨" }); },
    onError: (e) => toast({ tone: "err", msg: e.message }),
  });

  const now = Date.now();
  const expiresWarn = (t: Date | null) => t && t.getTime() - now < 7 * 24 * 3600 * 1000;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
        <p className="text-zinc-400 mt-1">Instagram Business · Threads 계정. OAuth로 연결.</p>
      </header>

      <div className="flex gap-3">
        <a className="btn btn-primary" href="/oauth/ig/start">+ Instagram 연결</a>
        <a className="btn btn-primary" href="/oauth/threads/start">+ Threads 연결</a>
      </div>

      {list.isLoading ? <Skeleton rows={2} height="h-24" />
        : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} />
        : list.data?.length === 0 ? (
          <Empty
            icon="@"
            title="연결된 계정이 없습니다"
            hint="위 버튼으로 Instagram Business 또는 Threads 계정을 연결하세요. (Instagram Reels는 Business 계정 + 연결된 Facebook Page 필수)"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {list.data?.map((a) => (
              <div key={a.id} className="card">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
                      <span className="font-medium truncate">@{a.handle}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">{a.platform}</div>
                    <div className="text-xs mt-3 space-y-0.5">
                      <div>
                        <span className="text-zinc-500">토큰 만료:</span>{" "}
                        <span className={expiresWarn(a.tokenExpiresAt) ? "text-amber-300" : "text-zinc-400"}>
                          {a.tokenExpiresAt ? a.tokenExpiresAt.toLocaleDateString("ko-KR") : "—"}
                        </span>
                      </div>
                      {a.refreshedAt ? (
                        <div>
                          <span className="text-zinc-500">최근 갱신:</span>{" "}
                          <span className="text-zinc-400">{a.refreshedAt.toLocaleDateString("ko-KR")}</span>
                        </div>
                      ) : null}
                    </div>
                    {expiresWarn(a.tokenExpiresAt) ? (
                      <a className="text-xs text-amber-300 mt-3 inline-block underline" href={`/oauth/${a.platform === "instagram" ? "ig" : "threads"}/start`}>
                        토큰 만료 임박 — 다시 연결
                      </a>
                    ) : null}
                  </div>
                  <button className="btn btn-danger text-xs shrink-0" onClick={() => {
                    if (confirm(`@${a.handle} 연결 해제?`)) remove.mutate({ id: a.id });
                  }}>제거</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
