import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProcessFilters } from "@/features/processes/components/ProcessFilters";
import { ProcessTable } from "@/features/processes/components/ProcessTable";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { listFilterOptions, listProcesses } from "@/services/process-data";

export const metadata = { title: "Processos" };

export default async function ProcessesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const values = {
    q: first(params.q),
    department: first(params.department),
    status: first(params.status),
    responsibleId: first(params.responsibleId),
    sort: first(params.sort),
  };
  const [processes, options] = await Promise.all([listProcesses(values), listFilterOptions()]);

  return (
    <>
      <PageHeader
        title="Processos"
        description="Pesquise, filtre e abra os processos da organização."
        actions={can(user.role, "create") ? <Link href="/processos/novo" className="inline-flex h-9 items-center bg-blue-800 px-3 text-sm font-medium text-white">+ Novo processo</Link> : null}
      />
      <ProcessFilters departments={options.departments} responsibles={options.responsibles} values={values} />
      {processes.length === 0 ? (
        <EmptyState title="Nenhum processo encontrado" description="Ajuste os filtros ou cadastre um novo processo." />
      ) : (
        <ProcessTable processes={processes} canEdit={can(user.role, "edit", "rascunho")} canDuplicate={can(user.role, "duplicate", "rascunho")} canArchive={can(user.role, "archive", "rascunho")} />
      )}
    </>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
