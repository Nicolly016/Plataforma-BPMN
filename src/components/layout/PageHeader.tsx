export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-zinc-600">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
