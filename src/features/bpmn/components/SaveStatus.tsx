import type { SaveStatus as SaveState } from "@/features/bpmn/utils/save-queue";

const LABELS: Record<SaveState, string> = {
  idle: "Sem alterações pendentes",
  saving: "Salvando...",
  saved: "Salvo",
  error: "Erro ao salvar",
};

export function SaveStatus({ status, message }: { status: SaveState; message?: string | null }) {
  const tone = status === "error" ? "text-red-700" : status === "saved" ? "text-emerald-700" : "text-zinc-500";
  return (
    <span className={`text-xs font-medium ${tone}`} role="status">
      {status === "error" && message ? message : LABELS[status]}
    </span>
  );
}
