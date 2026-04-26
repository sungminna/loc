import { createContext, useCallback, useContext, useState } from "react";

interface Toast { id: number; tone: "ok" | "err" | "info"; msg: string }

interface ToastCtx { push: (t: Omit<Toast, "id">) => void }
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl border shadow-lg text-sm backdrop-blur ${tone(t.tone)}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx.push;
}

function tone(t: Toast["tone"]): string {
  if (t === "ok") return "bg-emerald-500/15 border-emerald-500/40 text-emerald-100";
  if (t === "err") return "bg-red-500/15 border-red-500/40 text-red-100";
  return "bg-zinc-800/80 border-zinc-700 text-zinc-100";
}
