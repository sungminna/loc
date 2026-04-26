import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, footer, width = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const w = width === "sm" ? "max-w-md" : width === "lg" ? "max-w-3xl" : "max-w-xl";
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${w} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
        </header>
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">{children}</div>
        {footer ? <footer className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-2">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
