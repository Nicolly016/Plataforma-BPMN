import { parseBpmnXml } from "@/features/bpmn/utils/bpmn.utils";
import { AppError } from "@/lib/errors";
import { assertCan } from "@/services/permissions.service";
import type { ElementMetadata, ProcessStatus, UserRole } from "@/types/domain";
import { assertUuid } from "@/utils/guards";

const TEXT_LIMIT = 4000;
const ELEMENT_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;

export interface DiagramRecord {
  id: string;
  status: ProcessStatus;
}

export interface DiagramStore {
  findProcess(id: string): Promise<DiagramRecord | null>;
  saveXml(id: string, xml: string): Promise<void>;
}

export interface MetadataStore {
  findProcess(id: string): Promise<DiagramRecord | null>;
  upsert(processId: string, metadata: ElementMetadata): Promise<void>;
}

export async function saveDiagram(
  store: DiagramStore,
  actor: { role: UserRole },
  processId: string,
  xml: string,
): Promise<void> {
  assertUuid(processId, "Processo");
  const process = await store.findProcess(processId);

  if (!process) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  assertCan(actor.role, "edit", process.status);
  await parseBpmnXml(xml);
  await store.saveXml(processId, xml);
}

export function normalizeElementMetadata(input: ElementMetadata): ElementMetadata {
  if (!ELEMENT_ID_PATTERN.test(input.bpmnElementId)) {
    throw new AppError("O identificador do elemento BPMN é inválido.", "validation");
  }

  if (!input.elementType.startsWith("bpmn:") || input.elementType.length > 80) {
    throw new AppError("O tipo do elemento BPMN é inválido.", "validation");
  }

  const entries = Object.entries(input) as Array<[keyof ElementMetadata, string]>;
  const normalized = { ...input };

  for (const [key, value] of entries) {
    if (key === "bpmnElementId" || key === "elementType") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > TEXT_LIMIT) {
      throw new AppError("Um dos campos da documentação excede o limite de 4000 caracteres.", "validation");
    }

    normalized[key] = trimmed;
  }

  return normalized;
}

export async function saveElementMetadata(
  store: MetadataStore,
  actor: { role: UserRole },
  processId: string,
  metadata: ElementMetadata,
): Promise<void> {
  assertUuid(processId, "Processo");
  const process = await store.findProcess(processId);

  if (!process) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  assertCan(actor.role, "edit", process.status);
  await store.upsert(processId, normalizeElementMetadata(metadata));
}
