import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProcessForm } from "@/features/processes/components/ProcessForm";
import { createProcessAction } from "@/features/processes/actions";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { listProfiles } from "@/services/process-data";

export const metadata = { title: "Novo processo" };

export default async function NewProcessPage() {
  const user = await requireUser();
  if (!can(user.role, "create")) {
    redirect("/processos");
  }

  const profiles = await listProfiles();
  if (profiles.length === 0) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Novo processo" description="Depois do cadastro, o modelador BPMN abre com um fluxo inicial." />
      <ProcessForm action={createProcessAction} profiles={profiles} submitLabel="Criar e modelar" />
    </>
  );
}
