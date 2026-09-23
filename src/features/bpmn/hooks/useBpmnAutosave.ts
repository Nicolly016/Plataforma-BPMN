"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Modeler from "bpmn-js/lib/Modeler";
import type { BpmnEditorHandle } from "@/features/bpmn/types/bpmn.types";
import { SaveQueue, type SaveStatus } from "@/features/bpmn/utils/save-queue";

export function useBpmnAutosave(modeler: Modeler | null, handle: BpmnEditorHandle | null, saveXml: (xml: string) => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const queueRef = useRef<SaveQueue | null>(null);
  const saveRef = useRef(saveXml);
  const generation = useRef(0);
  const ready = useRef(false);

  useEffect(() => {
    saveRef.current = saveXml;
  }, [saveXml]);

  useEffect(() => {
    const queue = new SaveQueue(1500, setStatus);
    queueRef.current = queue;
    return () => queue.cancel();
  }, []);

  useEffect(() => {
    if (!modeler || !handle) {
      return;
    }

    ready.current = false;
    const onChange = () => {
      if (!ready.current) {
        return;
      }

      generation.current += 1;
      const current = generation.current;
      setDirty(true);
      setMessage(null);
      queueRef.current?.schedule(async () => {
        try {
          await saveRef.current(await handle.getXml());
          if (generation.current === current) {
            setDirty(false);
            setMessage(null);
          }
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Erro ao salvar");
          throw error;
        }
      });
    };

    modeler.on("commandStack.changed", onChange);
    ready.current = true;

    return () => {
      ready.current = false;
      modeler.off("commandStack.changed", onChange);
    };
  }, [modeler, handle]);

  const saveNow = useCallback(() => {
    if (!handle) {
      return;
    }

    generation.current += 1;
    const current = generation.current;
    setDirty(true);
    queueRef.current?.flushNow(async () => {
      try {
        await saveRef.current(await handle.getXml());
        if (generation.current === current) {
          setDirty(false);
          setMessage(null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar");
        throw error;
      }
    });
  }, [handle]);

  return { status, dirty, message, saveNow };
}
