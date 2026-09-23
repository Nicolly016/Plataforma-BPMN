import { BpmnModdle, type BpmnModdleElement } from "bpmn-moddle";
import { AppError } from "@/lib/errors";
import type { ProcessActivity } from "@/types/domain";
import { slugify } from "@/utils/format";

export const MAX_BPMN_XML_LENGTH = 2_000_000;

const ACTIVITY_TYPES = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:BusinessRuleTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:ScriptTask",
  "bpmn:CallActivity",
  "bpmn:SubProcess",
]);

const TYPE_LABELS: Record<string, string> = {
  "bpmn:StartEvent": "Evento de início",
  "bpmn:EndEvent": "Evento de fim",
  "bpmn:IntermediateCatchEvent": "Evento intermediário de captura",
  "bpmn:IntermediateThrowEvent": "Evento intermediário de lançamento",
  "bpmn:BoundaryEvent": "Evento de borda",
  "bpmn:Task": "Tarefa",
  "bpmn:UserTask": "Tarefa de usuário",
  "bpmn:ServiceTask": "Tarefa de serviço",
  "bpmn:ManualTask": "Tarefa manual",
  "bpmn:BusinessRuleTask": "Tarefa de regra de negócio",
  "bpmn:SendTask": "Tarefa de envio",
  "bpmn:ReceiveTask": "Tarefa de recebimento",
  "bpmn:ScriptTask": "Tarefa de script",
  "bpmn:SubProcess": "Subprocesso",
  "bpmn:CallActivity": "Atividade de chamada",
  "bpmn:ExclusiveGateway": "Gateway exclusivo",
  "bpmn:ParallelGateway": "Gateway paralelo",
  "bpmn:InclusiveGateway": "Gateway inclusivo",
  "bpmn:EventBasedGateway": "Gateway baseado em evento",
  "bpmn:SequenceFlow": "Fluxo de sequência",
  "bpmn:MessageFlow": "Fluxo de mensagem",
  "bpmn:Participant": "Pool",
  "bpmn:Lane": "Lane",
  "bpmn:DataObjectReference": "Objeto de dados",
  "bpmn:DataStoreReference": "Repositório de dados",
  "bpmn:TextAnnotation": "Anotação de texto",
};

export class BpmnXmlError extends AppError {
  constructor(message: string) {
    super(message, "validation");
    this.name = "BpmnXmlError";
  }
}

export function bpmnTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace("bpmn:", "");
}

export function isBpmnFilename(filename: string): boolean {
  return /\.(bpmn|xml)$/i.test(filename);
}

export function buildExportFileName(processName: string, version: string, extension: "bpmn" | "svg"): string {
  const slug = slugify(processName) || "processo";
  const safeVersion = version.replace(/[^0-9A-Za-z.]+/g, "") || "1.0";
  return `processo-${slug}-v${safeVersion}.${extension}`;
}

export function resolveShortcut(input: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  targetIsField: boolean;
}): "save" | "undo" | "redo" | "delete" | null {
  const key = input.key.toLowerCase();
  const mod = input.ctrlKey || input.metaKey;

  if (mod && key === "s") {
    return "save";
  }

  if (mod && ((input.shiftKey && key === "z") || key === "y")) {
    return "redo";
  }

  if (mod && key === "z") {
    return "undo";
  }

  if (!input.targetIsField && (key === "delete" || key === "backspace")) {
    return "delete";
  }

  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

export async function parseBpmnXml(xml: string): Promise<BpmnModdleElement> {
  const trimmed = xml.trim();

  if (!trimmed) {
    throw new BpmnXmlError("O XML BPMN está vazio.");
  }

  if (trimmed.length > MAX_BPMN_XML_LENGTH) {
    throw new BpmnXmlError("O XML BPMN excede o tamanho máximo permitido.");
  }

  const moddle = BpmnModdle();

  try {
    const result = await moddle.fromXML(trimmed);
    if (!result.rootElement) {
      throw new BpmnXmlError("O XML BPMN não contém uma definição válida.");
    }

    return result.rootElement;
  } catch (error) {
    if (error instanceof BpmnXmlError) {
      throw error;
    }

    throw new BpmnXmlError("Não foi possível interpretar o XML BPMN.");
  }
}

export async function extractActivities(xml: string): Promise<ProcessActivity[]> {
  const root = await parseBpmnXml(xml);
  const processes = collectProcesses(root);
  const activities: ProcessActivity[] = [];

  for (const process of processes) {
    collectOrderedActivities(process.flowElements ?? [], activities);
  }

  return activities.map((activity, index) => ({ ...activity, order: index + 1 }));
}

function collectProcesses(root: BpmnModdleElement): BpmnModdleElement[] {
  if (root.$type === "bpmn:Process") {
    return [root];
  }

  return (root.rootElements ?? []).filter((element) => element.$type === "bpmn:Process");
}

function collectOrderedActivities(flowElements: BpmnModdleElement[], activities: ProcessActivity[]): void {
  const nodes = new Map<string, { id: string; name: string; type: string; outgoing: string[] }>();
  const incoming = new Map<string, number>();

  for (const element of flowElements) {
    if (!element.id || element.$type === "bpmn:SequenceFlow") {
      continue;
    }

    nodes.set(element.id, {
      id: element.id,
      name: element.name?.trim() || "Sem nome",
      type: element.$type,
      outgoing: [],
    });
    incoming.set(element.id, 0);
  }

  for (const element of flowElements) {
    if (element.$type !== "bpmn:SequenceFlow") {
      continue;
    }

    const sourceId = referenceId(element.sourceRef);
    const targetId = referenceId(element.targetRef);
    if (!sourceId || !targetId) {
      continue;
    }

    nodes.get(sourceId)?.outgoing.push(targetId);
    incoming.set(targetId, (incoming.get(targetId) ?? 0) + 1);
  }

  const starts = [...nodes.values()]
    .filter((node) => node.type === "bpmn:StartEvent" || (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const queue = starts.length > 0 ? [...starts] : [...nodes.keys()];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const node = nodes.get(id);
    if (!node) {
      continue;
    }

    if (ACTIVITY_TYPES.has(node.type)) {
      activities.push({
        order: activities.length + 1,
        id: node.id,
        name: node.name,
        type: node.type,
        typeLabel: bpmnTypeLabel(node.type),
      });

      const source = flowElements.find((element) => element.id === node.id);
      if (node.type === "bpmn:SubProcess" && source?.flowElements) {
        collectOrderedActivities(source.flowElements, activities);
      }
    }

    queue.push(...node.outgoing);
  }

  for (const element of flowElements) {
    if (!element.id || !ACTIVITY_TYPES.has(element.$type) || activities.some((activity) => activity.id === element.id)) {
      continue;
    }

    activities.push({
      order: activities.length + 1,
      id: element.id,
      name: element.name?.trim() || "Sem nome",
      type: element.$type,
      typeLabel: bpmnTypeLabel(element.$type),
    });
  }
}

function referenceId(reference: BpmnModdleElement | string | undefined): string | undefined {
  if (!reference) {
    return undefined;
  }

  return typeof reference === "string" ? reference : reference.id;
}
