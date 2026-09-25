"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ElementPropertiesDrawer, ElementPropertiesPanel } from "@/features/bpmn/components/ElementPropertiesPanel";
import { ModelerToolbar } from "@/features/bpmn/components/ModelerToolbar";
import { TextModelerPanel } from "@/features/bpmn/components/TextModelerPanel";
import { saveDiagramAction, saveMetadataAction } from "@/features/bpmn/actions";
import { CommentLayer, type DiagramHost } from "@/features/bpmn/comments/CommentLayer";
import { visibleComment } from "@/features/bpmn/comments/comment-tooltip";
import { useBpmnAutosave } from "@/features/bpmn/hooks/useBpmnAutosave";
import { useBpmnKeyboardShortcuts, useUnsavedChangesGuard } from "@/features/bpmn/hooks/useBpmnKeyboardShortcuts";
import { useBpmnModeler } from "@/features/bpmn/hooks/useBpmnModeler";
import { useBpmnSelection } from "@/features/bpmn/hooks/useBpmnSelection";
import { DEFAULT_BPMN_XML } from "@/features/bpmn/utils/default-diagram";
import { buildExportFileName, isBpmnFilename } from "@/features/bpmn/utils/bpmn.utils";
import { SaveQueue } from "@/features/bpmn/utils/save-queue";
import type { ElementMetadata, ProcessDetails } from "@/types/domain";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

export function BpmnModeler({ process, initialMetadata }: { process: ProcessDetails; initialMetadata: ElementMetadata[] }) {
  const xml = process.bpmnXml ?? DEFAULT_BPMN_XML;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { modeler, handle, error } = useBpmnModeler(container, xml);
  const selected = useBpmnSelection(modeler, handle);
  const [metadata, setMetadata] = useState<Record<string, ElementMetadata>>(() => Object.fromEntries(initialMetadata.map((item) => [item.bpmnElementId, item])));
  const [metaStatus, setMetaStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const metadataRef = useRef(metadata);
  const pendingIds = useRef(new Set<string>());
  const metaQueue = useRef<SaveQueue | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(Boolean(process.bpmnXml));
  const [writerOpen, setWriterOpen] = useState(false);

  const saveXml = useCallback(async (value: string) => {
    const result = await saveDiagramAction(process.id, value);
    if (!result.ok) {
      throw new Error(result.message ?? "Erro ao salvar");
    }
  }, [process.id]);

  const autosave = useBpmnAutosave(modeler, handle, saveXml);
  const { saveNow, status: diagramStatus, dirty, message: diagramMessage } = autosave;
  useBpmnKeyboardShortcuts(Boolean(handle), handle, saveNow);
  useUnsavedChangesGuard(dirty || metaStatus === "saving");

  useEffect(() => {
    const queue = new SaveQueue(800, setMetaStatus);
    metaQueue.current = queue;
    return () => queue.cancel();
  }, []);

  useEffect(() => {
    if (!handle || seeded.current) {
      return;
    }

    seeded.current = true;
    saveNow();
  }, [handle, saveNow]);

  function onMetadataChange(next: ElementMetadata) {
    const updated = { ...metadataRef.current, [next.bpmnElementId]: next };
    metadataRef.current = updated;
    setMetadata(updated);
    pendingIds.current.add(next.bpmnElementId);
    setMetaMessage(null);
    metaQueue.current?.schedule(async () => {
      const ids = [...pendingIds.current];
      pendingIds.current.clear();
      for (const id of ids) {
        const item = metadataRef.current[id];
        if (!item) {
          continue;
        }
        const result = await saveMetadataAction(process.id, item);
        if (!result.ok) {
          pendingIds.current.add(id);
          setMetaMessage(result.message ?? "Erro ao salvar a documentação");
          throw new Error(result.message ?? "Erro ao salvar a documentação");
        }
      }
    });
  }

  async function onImport(file: File) {
    if (!handle) {
      return;
    }

    if (!isBpmnFilename(file.name)) {
      setImportError("Selecione um arquivo .bpmn ou .xml.");
      return;
    }

    const text = await file.text();
    try {
      await handle.importXml(text);
      setImportError(null);
    } catch {
      setImportError("O arquivo não é um BPMN válido. O diagrama atual foi mantido.");
    }
  }

  async function onApplyText(xml: string) {
    if (!handle) {
      return;
    }

    try {
      await handle.importXml(xml);
      handle.fit();
      setImportError(null);
      saveNow();
    } catch {
      setImportError("Não foi possível aplicar o fluxo escrito.");
    }
  }

  async function exportDiagram(kind: "bpmn" | "svg") {
    if (!handle) {
      return;
    }

    const content = kind === "bpmn" ? await handle.getXml() : await handle.getSvg();
    const filename = buildExportFileName(process.name, process.currentVersion, kind);
    const blob = new Blob([content], { type: kind === "bpmn" ? "application/xml" : "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const comments = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of Object.values(metadata)) {
      const text = visibleComment(item.comment);
      if (text) {
        map[item.bpmnElementId] = text;
      }
    }
    return map;
  }, [metadata]);

  const currentMetadata = selected ? metadata[selected.id] ?? null : null;
  const status = metaStatus === "error" ? "error" : diagramStatus;
  const message = metaMessage ?? diagramMessage;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModelerToolbar
        process={process}
        status={status}
        message={message}
        onSave={saveNow}
        onUndo={() => handle?.undo()}
        onRedo={() => handle?.redo()}
        onZoomIn={() => handle?.zoomIn()}
        onZoomOut={() => handle?.zoomOut()}
        onFit={() => handle?.fit()}
        onImport={() => fileRef.current?.click()}
        onExportBpmn={() => void exportDiagram("bpmn")}
        onExportSvg={() => void exportDiagram("svg")}
        writerOpen={writerOpen}
        onToggleWriter={() => setWriterOpen((open) => !open)}
      />
      {importError ? <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{importError}</p> : null}
      {error ? <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {writerOpen ? <TextModelerPanel onApply={(xml) => void onApplyText(xml)} onClose={() => setWriterOpen(false)} /> : null}
        <div ref={setContainer} className="bpmn-host relative min-h-[280px] min-w-0 flex-1 bg-white" />
        <CommentLayer viewer={modeler as DiagramHost | null} comments={comments} />
        <ElementPropertiesPanel element={selected} metadata={currentMetadata} onRename={(name) => handle?.rename(name)} onChange={onMetadataChange} />
      </div>
      <ElementPropertiesDrawer element={selected} metadata={currentMetadata} onRename={(name) => handle?.rename(name)} onChange={onMetadataChange} />
      <input
        ref={fileRef}
        type="file"
        accept=".bpmn,.xml,application/xml,text/xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void onImport(file);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
