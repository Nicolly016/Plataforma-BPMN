export type ShortcutAction = "save" | "undo" | "redo" | "delete";

export interface SelectedElement {
  id: string;
  type: string;
  name: string;
}

export interface BpmnEditorHandle {
  undo: () => void;
  redo: () => void;
  removeSelection: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  rename: (name: string) => void;
  getXml: () => Promise<string>;
  getSvg: () => Promise<string>;
  importXml: (xml: string) => Promise<void>;
  readSelection: () => SelectedElement | null;
}
