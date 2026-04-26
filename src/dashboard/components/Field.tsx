interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <div className="label">{label}</div>
      {children}
      {error ? <div className="text-xs text-red-400 mt-1">{error}</div>
        : hint ? <div className="text-xs text-zinc-500 mt-1">{hint}</div>
        : null}
    </label>
  );
}
