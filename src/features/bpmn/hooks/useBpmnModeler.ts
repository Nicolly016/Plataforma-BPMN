"use client";

import { useEffect, useRef, useState } from "react";
import type Modeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";
import type CommandStack from "diagram-js/lib/command/CommandStack";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeling from "bpmn-js/lib/features/modeling/Modeling";
import type { BpmnEditorHandle, SelectedElement } from "@/features/bpmn/types/bpmn.types";
import { isRecord } from "@/utils/guards";

export function useBpmnModeler(container: HTMLDivElement | null, xml: string) {
  const [modeler, setModeler] = useState<Modeler | null>(null);
  const [handle, setHandle] = useState<BpmnEditorHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xmlRef = useRef(xml);

  useEffect(() => {
    if (!container) {
      return;
    }

    const host = container;
    let active = true;
    let instance: Modeler | null = null;

    async function mount() {
      const modelerModule = await import("bpmn-js/lib/Modeler");
      if (!active) {
        return;
      }

      const created = new modelerModule.default({ container: host });
      instance = created;

      try {
        await created.importXML(xmlRef.current);
        created.get<Canvas>("canvas").zoom("fit-viewport");
      } catch {
        if (active) {
          setError("Não foi possível abrir o diagrama BPMN.");
          created.destroy();
        }
        return;
      }

      if (!active) {
        return;
      }

      setHandle(createHandle(created));
      setModeler(created);
    }

    void mount();

    return () => {
      active = false;
      instance?.destroy();
      setHandle(null);
      setModeler(null);
    };
  }, [container]);

  return { modeler, handle, error };
}

function createHandle(modeler: Modeler): BpmnEditorHandle {
  return {
    undo() {
      const stack = modeler.get<CommandStack>("commandStack");
      if (stack.canUndo()) {
        stack.undo();
      }
    },
    redo() {
      const stack = modeler.get<CommandStack>("commandStack");
      if (stack.canRedo()) {
        stack.redo();
      }
    },
    removeSelection() {
      const selected = readElement(modeler);
      if (!selected) {
        return;
      }

      const registry = modeler.get<ElementRegistry>("elementRegistry");
      const element = registry.get(selected.id);
      if (!element || !isBpmnElement(element)) {
        return;
      }

      modeler.get<Modeling>("modeling").removeElements([element]);
    },
    zoomIn() {
      const canvas = modeler.get<Canvas>("canvas");
      canvas.zoom(Math.min(canvas.zoom() * 1.2, 4));
    },
    zoomOut() {
      const canvas = modeler.get<Canvas>("canvas");
      canvas.zoom(Math.max(canvas.zoom() / 1.2, 0.2));
    },
    fit() {
      modeler.get<Canvas>("canvas").zoom("fit-viewport");
    },
    rename(name: string) {
      const selected = readElement(modeler);
      if (!selected) {
        return;
      }

      const element = modeler.get<ElementRegistry>("elementRegistry").get(selected.id);
      if (!element || !isBpmnElement(element)) {
        return;
      }

      modeler.get<Modeling>("modeling").updateLabel(element, name);
    },
    async getXml() {
      const result = await modeler.saveXML({ format: true });
      if (!result.xml) {
        throw new Error("O modelador não retornou o XML.");
      }
      return result.xml;
    },
    async getSvg() {
      const result = await modeler.saveSVG();
      return result.svg;
    },
    async importXml(xml: string) {
      const current = await modeler.saveXML({ format: true });
      try {
        await modeler.importXML(xml);
      } catch (error) {
        if (current.xml) {
          await modeler.importXML(current.xml);
        }
        throw error;
      }
    },
    readSelection() {
      return readElement(modeler);
    },
  };
}

function readElement(modeler: Modeler): SelectedElement | null {
  const selection = modeler.get<{ get: () => unknown[] }>("selection");
  return toSelected(selection.get()[0]);
}

function toSelected(value: unknown): SelectedElement | null {
  const element = unwrapLabel(value);
  if (!isRecord(element) || typeof element.id !== "string" || typeof element.type !== "string" || element.type === "label") {
    return null;
  }

  const businessObject = element.businessObject;
  const name = isRecord(businessObject) && typeof businessObject.name === "string" ? businessObject.name : "";
  return { id: element.id, type: element.type, name };
}

function isBpmnElement(value: { id: string }): value is Parameters<Modeling["updateLabel"]>[0] {
  return "type" in value && typeof value.type === "string" && "di" in value && "businessObject" in value;
}

function unwrapLabel(value: unknown): unknown {
  if (!isRecord(value) || value.type !== "label") {
    return value;
  }

  return value.labelTarget ?? value;
}
