import Link from "next/link";
import { notFound } from "next/navigation";
import { BpmnViewer } from "@/features/bpmn/components/BpmnViewer";
import { DEFAULT_BPMN_XML } from "@/features/bpmn/utils/default-diagram";
import { extractActivities } from "@/features/bpmn/utils/bpmn.utils";
import { ProcessStatusBadge } from "@/features/processes/components/ProcessStatusBadge";
import { requireUser } from "@/lib/auth";
import { can } from "@/services/permissions.service";
import { getProcess, listElementMetadata, listVersions } from "@/services/process-data";
import { formatDateTime } from "@/utils/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await getProcess(id);
  return { title: process?.name ?? "Processo" };
}

export default async function ProcessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  const process = await getProcess(id);
  if (!process || !can(user.role, "view", process.status)) {
    notFound();
  }

  const tab = first(query.aba) || "visao";
  const elementId = first(query.elemento);
  const [metadata, versions, activities] = await Promise.all([
    listElementMetadata(process.id),
    listVersions(process.id),
    extractActivities(process.bpmnXml ?? DEFAULT_BPMN_XML),
  ]);
  const metadataById = new Map(metadata.map((item) => [item.bpmnElementId, item]));
  const selected = activities.find((activity) => activity.id === elementId) ?? null;
  const selectedMetadata = selected ? metadataById.get(selected.id) : undefined;
  const tabs = [
    ["visao", "Visão geral"],
    ["fluxograma", "Fluxograma"],
    ["documentacao", "Documentação"],
    ["atividades", "Atividades"],
    ["versoes", "Versões"],
  ] as const;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-950">{process.name}</h1>
            <ProcessStatusBadge status={process.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{process.code}</p>
        </div>
        {can(user.role, "edit", process.status) ? (
          <Link href={`/processos/${process.id}/modelador`} className="inline-flex h-9 items-center bg-blue-800 px-3 text-sm font-medium text-white">
            Abrir modelador
          </Link>
        ) : null}
      </div>
      <dl className="mb-6 grid gap-3 border border-zinc-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Objetivo" value={process.objective || "Não informado"} />
        <Info label="Responsável" value={process.responsibleName ?? "Não informado"} />
        <Info label="Unidade" value={process.department} />
        <Info label="Versão" value={process.currentVersion} />
        <Info label="Atualização" value={formatDateTime(process.updatedAt)} />
        <Info label="Categoria" value={process.category} />
      </dl>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {tabs.map(([value, label]) => (
          <Link key={value} href={`/processos/${process.id}?aba=${value}`} className={`px-3 py-2 text-sm ${tab === value ? "border-b-2 border-blue-800 font-medium text-zinc-950" : "text-zinc-600"}`}>
            {label}
          </Link>
        ))}
      </div>
      {tab === "visao" ? <p className="max-w-3xl text-sm leading-6 text-zinc-700">{process.description || "Este processo ainda não possui descrição."}</p> : null}
      {tab === "fluxograma" ? (
        <BpmnViewer
          xml={process.bpmnXml ?? DEFAULT_BPMN_XML}
          comments={Object.fromEntries(metadata.flatMap((item) => (item.comment.trim() ? [[item.bpmnElementId, item.comment.trim()]] : [])))}
        />
      ) : null}
      {tab === "documentacao" ? <Documentation metadata={metadata} activities={activities} /> : null}
      {tab === "atividades" ? (
        <Activities activities={activities} metadataById={metadataById} processId={process.id} selected={selected} selectedMetadata={selectedMetadata} />
      ) : null}
      {tab === "versoes" ? <Versions versions={versions} /> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

function Documentation({ metadata, activities }: { metadata: Awaited<ReturnType<typeof listElementMetadata>>; activities: Awaited<ReturnType<typeof extractActivities>> }) {
  const names = new Map(activities.map((activity) => [activity.id, activity.name]));
  const documented = metadata.filter((item) => item.description || item.comment || item.documentation || item.notes);
  if (documented.length === 0) {
    return <p className="text-sm text-zinc-600">Nenhum elemento foi documentado ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {documented.map((item) => (
        <article key={item.bpmnElementId} className="border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">{names.get(item.bpmnElementId) ?? item.bpmnElementId}</h2>
          {item.description ? <p className="mt-2 text-sm text-zinc-700">{item.description}</p> : null}
          {item.comment ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600"><span className="font-medium text-zinc-800">Comentário. </span>{item.comment}</p> : null}
          {item.documentation ? <p className="mt-2 text-sm text-zinc-600">{item.documentation}</p> : null}
        </article>
      ))}
    </div>
  );
}

function Activities({
  activities,
  metadataById,
  processId,
  selected,
  selectedMetadata,
}: {
  activities: Awaited<ReturnType<typeof extractActivities>>;
  metadataById: Map<string, Awaited<ReturnType<typeof listElementMetadata>>[number]>;
  processId: string;
  selected: Awaited<ReturnType<typeof extractActivities>>[number] | null;
  selectedMetadata: Awaited<ReturnType<typeof listElementMetadata>>[number] | undefined;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-zinc-600">O diagrama não possui tarefas.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {["Ordem", "Atividade", "Tipo", "Responsável", "Unidade", "Prazo", "Sistema", "Entrada", "Saída"].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => {
              const meta = metadataById.get(activity.id);
              return (
                <tr key={activity.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2">{activity.order}</td>
                  <td className="px-3 py-2">
                    <Link href={`/processos/${processId}?aba=atividades&elemento=${activity.id}`} className="font-medium hover:underline">{activity.name}</Link>
                  </td>
                  <td className="px-3 py-2">{activity.typeLabel}</td>
                  <td className="px-3 py-2">{meta?.responsible || "—"}</td>
                  <td className="px-3 py-2">{meta?.department || "—"}</td>
                  <td className="px-3 py-2">{meta?.estimatedTime || "—"}</td>
                  <td className="px-3 py-2">{meta?.systems || "—"}</td>
                  <td className="px-3 py-2">{meta?.inputs || "—"}</td>
                  <td className="px-3 py-2">{meta?.outputs || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <article className="border border-zinc-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">{selected.name}</h2>
          <p className="mt-1 text-zinc-500">{selected.typeLabel}</p>
          <p className="mt-3">{selectedMetadata?.documentation || selectedMetadata?.description || "Esta atividade ainda não possui documentação."}</p>
          {selectedMetadata?.comment ? <p className="mt-3 whitespace-pre-wrap text-zinc-700"><span className="font-medium">Comentário. </span>{selectedMetadata.comment}</p> : null}
        </article>
      ) : null}
    </div>
  );
}

function Versions({ versions }: { versions: Awaited<ReturnType<typeof listVersions>> }) {
  return (
    <div>
      <p className="mb-3 text-sm text-zinc-600">A criação e a restauração de versões entram na próxima etapa. Nenhuma versão antiga é sobrescrita.</p>
      {versions.length === 0 ? <p className="text-sm text-zinc-600">Ainda não há snapshots neste processo.</p> : (
        <ul className="divide-y divide-zinc-200 border border-zinc-200 bg-white">
          {versions.map((version) => (
            <li key={version.id} className="px-4 py-3 text-sm">
              <span className="font-medium">v{version.versionNumber}</span>
              <span className="text-zinc-500"> · {version.createdByName ?? "—"} · {formatDateTime(version.createdAt)}</span>
              {version.notes ? <p className="mt-1 text-zinc-600">{version.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
