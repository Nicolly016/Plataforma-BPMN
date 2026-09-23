"use client";

import Link from "next/link";
import { Download, Maximize, PenLine, Redo2, Save, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown, MenuItem } from "@/components/ui/Dropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { SaveStatus } from "@/features/bpmn/components/SaveStatus";
import { ProcessStatusBadge } from "@/features/processes/components/ProcessStatusBadge";
import type { ProcessDetails } from "@/types/domain";
import type { SaveStatus as SaveState } from "@/features/bpmn/utils/save-queue";

export function ModelerToolbar({
  process,
  status,
  message,
  onSave,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFit,
  onImport,
  onExportBpmn,
  onExportSvg,
  writerOpen,
  onToggleWriter,
}: {
  process: ProcessDetails;
  status: SaveState;
  message: string | null;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onImport: () => void;
  onExportBpmn: () => void;
  onExportSvg: () => void;
  writerOpen: boolean;
  onToggleWriter: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      <Link href={`/processos/${process.id}`} className="inline-flex h-8 items-center px-2.5 text-sm text-zinc-700 hover:bg-zinc-100">
        Voltar
      </Link>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-950">{process.name}</p>
        <p className="truncate text-xs text-zinc-500">
          {process.code} · v{process.currentVersion}
        </p>
      </div>
      <ProcessStatusBadge status={process.status} />
      <div className="ml-auto flex items-center gap-2">
        <SaveStatus status={status} message={message} />
        <Button size="sm" variant={writerOpen ? "primary" : "secondary"} onClick={onToggleWriter} aria-pressed={writerOpen}>
          <PenLine size={16} />
          <span className="hidden sm:inline">Escrever</span>
        </Button>
        <Tooltip label="Salvar (Ctrl+S)">
          <Button size="sm" variant="primary" onClick={onSave} aria-label="Salvar">
            <Save size={16} />
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        </Tooltip>
        <div className="hidden items-center gap-1 xl:flex">
          <IconButton label="Desfazer (Ctrl+Z)" onClick={onUndo}><Undo2 size={16} /></IconButton>
          <IconButton label="Refazer (Ctrl+Shift+Z)" onClick={onRedo}><Redo2 size={16} /></IconButton>
          <IconButton label="Aumentar zoom" onClick={onZoomIn}><ZoomIn size={16} /></IconButton>
          <IconButton label="Diminuir zoom" onClick={onZoomOut}><ZoomOut size={16} /></IconButton>
          <IconButton label="Ajustar à tela" onClick={onFit}><Maximize size={16} /></IconButton>
          <IconButton label="Importar BPMN" onClick={onImport}><Upload size={16} /></IconButton>
          <IconButton label="Exportar BPMN" onClick={onExportBpmn}><Download size={16} /></IconButton>
          <Button size="sm" onClick={onExportSvg}>SVG</Button>
        </div>
        <div className="xl:hidden">
          <Dropdown label="Ações">
            <MenuItem><button type="button" onClick={onToggleWriter}>Escrever fluxo</button></MenuItem>
            <MenuItem><button type="button" onClick={onUndo}>Desfazer</button></MenuItem>
            <MenuItem><button type="button" onClick={onRedo}>Refazer</button></MenuItem>
            <MenuItem><button type="button" onClick={onZoomIn}>Zoom +</button></MenuItem>
            <MenuItem><button type="button" onClick={onZoomOut}>Zoom -</button></MenuItem>
            <MenuItem><button type="button" onClick={onFit}>Ajustar à tela</button></MenuItem>
            <MenuItem><button type="button" onClick={onImport}>Importar BPMN</button></MenuItem>
            <MenuItem><button type="button" onClick={onExportBpmn}>Exportar BPMN</button></MenuItem>
            <MenuItem><button type="button" onClick={onExportSvg}>Exportar SVG</button></MenuItem>
            <MenuItem><button type="button" disabled title="Disponível na próxima etapa">Nova versão</button></MenuItem>
            <MenuItem><button type="button" disabled title="Disponível na próxima etapa">Publicar</button></MenuItem>
          </Dropdown>
        </div>
        <div className="hidden gap-1 xl:flex">
          <Button size="sm" disabled title="Disponível na próxima etapa">Nova versão</Button>
          <Button size="sm" disabled title="Disponível na próxima etapa">Publicar</Button>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <Button size="sm" onClick={onClick} aria-label={label}>
        {children}
      </Button>
    </Tooltip>
  );
}
