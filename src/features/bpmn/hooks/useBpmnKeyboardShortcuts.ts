"use client";

import { useEffect } from "react";
import type { BpmnEditorHandle } from "@/features/bpmn/types/bpmn.types";
import { isTypingTarget, resolveShortcut } from "@/features/bpmn/utils/bpmn.utils";

export function useBpmnKeyboardShortcuts(enabled: boolean, handle: BpmnEditorHandle | null, onSave: () => void) {
  useEffect(() => {
    if (!enabled || !handle) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        targetIsField: isTypingTarget(event.target),
      });

      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (action === "save") {
        onSave();
      } else if (action === "undo") {
        handle.undo();
      } else if (action === "redo") {
        handle.redo();
      } else {
        handle.removeSelection();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, handle, onSave]);
}

export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!dirty || !(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || href.startsWith("#")) {
        return;
      }

      if (!window.confirm("Existem alterações ainda não salvas. Deseja sair?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
