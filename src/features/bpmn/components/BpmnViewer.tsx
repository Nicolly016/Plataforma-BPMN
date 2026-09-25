"use client";

import { useEffect, useState } from "react";
import { CommentLayer, type DiagramHost } from "@/features/bpmn/comments/CommentLayer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

export function BpmnViewer({ xml, comments = {} }: { xml: string; comments?: Record<string, string> }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<DiagramHost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container) {
      return;
    }

    let active = true;
    let instance: { destroy: () => void; importXML: (value: string) => Promise<unknown>; get: <T>(name: string) => T } | null = null;

    async function mount() {
      const viewerModule = await import("bpmn-js/lib/NavigatedViewer");
      if (!active || !container) {
        return;
      }

      const created = new viewerModule.default({ container });
      instance = created;
      try {
        await created.importXML(xml);
        created.get<{ zoom: (value: "fit-viewport") => void }>("canvas").zoom("fit-viewport");
        if (active) {
          setViewer(created as DiagramHost);
        }
      } catch {
        if (active) {
          setError("Não foi possível exibir o fluxograma.");
        }
      }
    }

    void mount();

    return () => {
      active = false;
      setViewer(null);
      instance?.destroy();
    };
  }, [container, xml]);

  if (error) {
    return <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  }

  return (
    <>
      <div ref={setContainer} className="bpmn-host h-[640px] border border-zinc-200 bg-white" />
      <CommentLayer viewer={viewer} comments={comments} />
    </>
  );
}
