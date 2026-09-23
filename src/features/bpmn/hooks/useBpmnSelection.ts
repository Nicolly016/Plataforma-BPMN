"use client";

import { useEffect, useState } from "react";
import type Modeler from "bpmn-js/lib/Modeler";
import type { BpmnEditorHandle, SelectedElement } from "@/features/bpmn/types/bpmn.types";

export function useBpmnSelection(modeler: Modeler | null, handle: BpmnEditorHandle | null) {
  const [selected, setSelected] = useState<SelectedElement | null>(null);

  useEffect(() => {
    if (!modeler || !handle) {
      return;
    }

    const refresh = () => {
      setSelected(handle.readSelection());
    };

    refresh();
    modeler.on("selection.changed", refresh);
    modeler.on("commandStack.changed", refresh);

    return () => {
      modeler.off("selection.changed", refresh);
      modeler.off("commandStack.changed", refresh);
    };
  }, [modeler, handle]);

  return selected;
}
