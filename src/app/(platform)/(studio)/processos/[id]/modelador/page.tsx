import { notFound, redirect } from "next/navigation";
import { BpmnModeler } from "@/features/bpmn/components/BpmnModeler";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { getProcess, listElementMetadata } from "@/services/process-data";

export const metadata = { title: "Modelador" };

export default async function ModelerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, process] = await Promise.all([requireUser(), getProcess(id)]);

  if (!process || !can(user.role, "view", process.status)) {
    notFound();
  }

  if (!can(user.role, "edit", process.status)) {
    redirect(`/processos/${process.id}`);
  }

  const metadata = await listElementMetadata(process.id);
  return <BpmnModeler process={process} initialMetadata={metadata} />;
}
