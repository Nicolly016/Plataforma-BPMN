"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Dropdown, MenuItem } from "@/components/ui/Dropdown";
import { archiveProcessAction, duplicateProcessAction } from "@/features/processes/actions";
import { ProcessStatusBadge } from "@/features/processes/components/ProcessStatusBadge";
import type { ProcessListItem } from "@/types/domain";
import { formatDateTime } from "@/utils/format";

export function ProcessTable({
  processes,
  canEdit,
  canDuplicate,
  canArchive,
}: {
  processes: ProcessListItem[];
  canEdit: boolean;
  canDuplicate: boolean;
  canArchive: boolean;
}) {
  if (processes.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto border border-zinc-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Nome</th>
            <th className="px-3 py-2 font-medium">Unidade</th>
            <th className="px-3 py-2 font-medium">Responsável</th>
            <th className="px-3 py-2 font-medium">Versão</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Atualização</th>
            <th className="px-3 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((process) => (
            <tr key={process.id} className="border-t border-zinc-200">
              <td className="px-3 py-3">
                <Link href={`/processos/${process.id}`} className="font-medium text-zinc-950 hover:underline">
                  {process.name}
                </Link>
                <p className="text-xs text-zinc-500">{process.code}</p>
              </td>
              <td className="px-3 py-3 text-zinc-700">{process.department}</td>
              <td className="px-3 py-3 text-zinc-700">{process.responsibleName ?? "—"}</td>
              <td className="px-3 py-3 text-zinc-700">{process.currentVersion}</td>
              <td className="px-3 py-3">
                <ProcessStatusBadge status={process.status} />
              </td>
              <td className="px-3 py-3 text-zinc-600">{formatDateTime(process.updatedAt)}</td>
              <td className="px-3 py-3">
                <RowActions process={process} canEdit={canEdit && process.status !== "arquivado"} canDuplicate={canDuplicate && process.status !== "arquivado"} canArchive={canArchive && process.status !== "arquivado"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ process, canEdit, canDuplicate, canArchive }: { process: ProcessListItem; canEdit: boolean; canDuplicate: boolean; canArchive: boolean }) {
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <Dropdown label="Ações">
        <MenuItem>
          <Link href={`/processos/${process.id}`}>Visualizar</Link>
        </MenuItem>
        {canEdit ? (
          <>
            <MenuItem>
              <Link href={`/processos/${process.id}/modelador`}>Modelar</Link>
            </MenuItem>
            <MenuItem>
              <Link href={`/processos/${process.id}/editar`}>Editar</Link>
            </MenuItem>
          </>
        ) : null}
        {canDuplicate ? (
          <MenuItem>
            <form action={duplicateProcessAction}>
              <input type="hidden" name="processId" value={process.id} />
              <button type="submit">Duplicar</button>
            </form>
          </MenuItem>
        ) : null}
        {canArchive ? (
          <MenuItem>
            <button type="button" onClick={() => setConfirm(true)}>
              Arquivar
            </button>
          </MenuItem>
        ) : null}
      </Dropdown>
      {confirm ? (
        <Modal title="Arquivar processo" onClose={() => setConfirm(false)}>
          <p className="text-sm text-zinc-600">O processo {process.name} deixará de aparecer para edição. O diagrama e a documentação permanecem disponíveis para consulta.</p>
          <form action={archiveProcessAction} className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="danger" type="submit" name="processId" value={process.id}>
              Arquivar
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
