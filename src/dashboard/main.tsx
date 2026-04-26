import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { trpc } from "./trpc";
import { ToastProvider } from "./components/Toast";
import { Topics } from "./pages/Topics";
import { Posts } from "./pages/Posts";
import { Audio } from "./pages/Audio";
import { Accounts } from "./pages/Accounts";
import { Templates } from "./pages/Templates";
import { Overview } from "./pages/Overview";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc",
    transformer: superjson,
    fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
  })],
});

const NAV = [
  { to: "/", label: "Overview", icon: "○" },
  { to: "/topics", label: "Topics", icon: "◆" },
  { to: "/templates", label: "Templates", icon: "▣" },
  { to: "/accounts", label: "Accounts", icon: "@" },
  { to: "/audio", label: "Audio", icon: "♪" },
  { to: "/posts", label: "Posts", icon: "✦" },
];

function UserBadge() {
  const me = trpc.me.useQuery();
  if (me.isLoading) return <div className="text-xs text-zinc-500 animate-pulse">로딩...</div>;
  if (me.error) return <div className="text-xs text-red-400">로그인 필요</div>;
  const u = me.data!;
  return (
    <div className="border-t border-zinc-800/80 mt-auto pt-4">
      <div className="text-xs text-zinc-500 truncate">{u.email}</div>
      <div className="text-[10px] text-zinc-600 uppercase mt-0.5 tracking-wider">{u.role}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-zinc-800/80 p-6 flex flex-col gap-1.5 sticky top-0 h-screen">
        <Link to="/" className="text-xl font-black mb-6 tracking-tight flex items-center gap-2">
          <span className="text-yellow-300">●</span>
          <span>Loc</span>
        </Link>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition flex items-center gap-3 ${isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`
            }
          >
            <span className="text-zinc-500 w-4 text-center">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <UserBadge />
      </aside>
      <main className="flex-1 p-10 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/audio" element={<Audio />} />
            <Route path="/posts" element={<Posts />} />
          </Routes>
        </Shell>
      </ToastProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
