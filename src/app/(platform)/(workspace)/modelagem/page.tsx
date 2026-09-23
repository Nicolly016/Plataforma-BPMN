import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProcessStatusBadge } from "@/features/processes/components/ProcessStatusBadge";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { listProcesses } from "@/services/process-data";

export const metadata = { title: "Modelagem" };

export default async function ModelingPage() {
  const user = await requireUser();
  const processes = (await listProcesses({})).filter((process) => can(user.role, "edit", process.status));

  return (
    <>
      <PageHeader title="Modelagem" description="Abra um processo em elaboração para editar o fluxo BPMN." />
      {processes.length === 0 ? (
        <EmptyState title="Nenhum processo disponível para edição" description="Crie um processo ou peça acesso de editor para modelar fluxos." />
      ) : (
        <ul className="divide-y divide-zinc-200 border border-zinc-200 bg-white">
          {processes.map((process) => (
            <li key={process.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{process.name}</p>
                <p className="text-xs text-zinc-500">{process.code} · {process.department}</p>
              </div>
              <div className="flex items-center gap-3">
                <ProcessStatusBadge status={process.status} />
                <Link href={`/processos/${process.id}/modelador`} className="text-sm font-medium text-blue-800 hover:underline">Abrir modelador</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
