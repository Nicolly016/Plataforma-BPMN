import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProcessForm } from "@/features/processes/components/ProcessForm";
import { updateProcessAction } from "@/features/processes/actions";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { getProcess, listProfiles } from "@/services/process-data";

export const metadata = { title: "Editar processo" };

export default async function EditProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, process, profiles] = await Promise.all([requireUser(), getProcess(id), listProfiles()]);

  if (!process || !can(user.role, "view", process.status)) {
    notFound();
  }

  if (!can(user.role, "edit", process.status)) {
    redirect(`/processos/${process.id}`);
  }

  const action = updateProcessAction.bind(null, process.id);

  return (
    <>
      <PageHeader title="Editar processo" description={process.name} />
      <ProcessForm action={action} profiles={profiles} process={process} allowStatus={user.role === "administrador"} submitLabel="Salvar dados" />
    </>
  );
}
