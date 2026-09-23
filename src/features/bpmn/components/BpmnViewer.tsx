"use client";

import { useEffect, useState } from "react";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

export function BpmnViewer({ xml }: { xml: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container) {
      return;
    }

    let active = true;
    let viewer: { destroy: () => void; importXML: (value: string) => Promise<unknown>; get: <T>(name: string) => T } | null = null;

    async function mount() {
      const viewerModule = await import("bpmn-js/lib/NavigatedViewer");
      if (!active || !container) {
        return;
      }

      viewer = new viewerModule.default({ container });
      try {
        await viewer.importXML(xml);
        viewer.get<{ zoom: (value: "fit-viewport") => void }>("canvas").zoom("fit-viewport");
      } catch {
        if (active) {
          setError("Não foi possível exibir o fluxograma.");
        }
      }
    }

    void mount();

    return () => {
      active = false;
      viewer?.destroy();
    };
  }, [container, xml]);

  if (error) {
    return <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  }

  return <div ref={setContainer} className="bpmn-host h-[640px] border border-zinc-200 bg-white" />;
}
