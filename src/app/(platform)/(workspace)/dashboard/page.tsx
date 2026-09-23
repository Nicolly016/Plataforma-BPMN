import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProcessTable } from "@/features/processes/components/ProcessTable";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { getDashboard } from "@/services/process-data";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard();
  const cards = [
    ["Processos", data.total],
    ["Em elaboração", data.rascunho],
    ["Em revisão", data.emRevisao],
    ["Publicados", data.publicado],
    ["Arquivados", data.arquivado],
    ["Alterados em 7 dias", data.recentChanges],
  ] as const;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Acompanhe o andamento dos processos organizacionais."
        actions={can(user.role, "create") ? <Link href="/processos/novo" className="inline-flex h-9 items-center bg-blue-800 px-3 text-sm font-medium text-white">+ Novo processo</Link> : null}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={label} className="border border-zinc-200 bg-white px-4 py-3">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-950">Processos recentes</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="Nenhum processo cadastrado" description="Crie o primeiro processo para começar a modelagem BPMN." action={can(user.role, "create") ? <Link href="/processos/novo"><Button variant="primary">+ Novo processo</Button></Link> : null} />
        ) : (
          <ProcessTable processes={data.recent} canEdit={can(user.role, "edit", "rascunho")} canDuplicate={can(user.role, "duplicate", "rascunho")} canArchive={can(user.role, "archive", "rascunho")} />
        )}
      </section>
    </>
  );
}
