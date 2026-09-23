import { STATUS_LABELS, type ProcessStatus } from "@/types/domain";
import { cn } from "@/utils/format";

const STYLES: Record<ProcessStatus, string> = {
  rascunho: "bg-zinc-100 text-zinc-700",
  em_revisao: "bg-amber-50 text-amber-800",
  publicado: "bg-emerald-50 text-emerald-800",
  arquivado: "bg-zinc-200 text-zinc-600",
};

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium", STYLES[status])}>{STATUS_LABELS[status]}</span>;
}
