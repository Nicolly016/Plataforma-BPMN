export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute top-full left-1/2 z-40 mt-1 hidden -translate-x-1/2 whitespace-nowrap bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  );
}
