interface SkeletonProps { rows?: number; height?: string }
export function Skeleton({ rows = 3, height = "h-20" }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-zinc-900/50 border border-zinc-800/60 animate-pulse`} />
      ))}
    </div>
  );
}

interface EmptyProps { title: string; hint?: string; cta?: React.ReactNode; icon?: string }
export function Empty({ title, hint, cta, icon = "✨" }: EmptyProps) {
  return (
    <div className="card text-center py-14">
      <div className="text-5xl mb-3 opacity-60">{icon}</div>
      <div className="text-zinc-200 font-medium">{title}</div>
      {hint ? <div className="text-zinc-500 text-sm mt-2 max-w-md mx-auto">{hint}</div> : null}
      {cta ? <div className="mt-5">{cta}</div> : null}
    </div>
  );
}

interface ErrorBoxProps { error: unknown; onRetry?: () => void }
export function ErrorBox({ error, onRetry }: ErrorBoxProps) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="card border-red-500/40 bg-red-500/5">
      <div className="text-red-300 font-medium">로딩 실패</div>
      <div className="text-zinc-400 text-sm mt-1 break-all">{msg}</div>
      {onRetry ? <button className="btn btn-ghost mt-3" onClick={onRetry}>다시 시도</button> : null}
    </div>
  );
}
