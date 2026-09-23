import { DEFAULT_BPMN_XML } from "@/features/bpmn/utils/default-diagram";
import { AppError } from "@/lib/errors";
import { assertCan } from "@/services/permissions.service";
import type { ProcessStatus, UserRole } from "@/types/domain";
import { isUuid } from "@/utils/guards";

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

export interface CreateProcessInput {
  code: string;
  name: string;
  description: string;
  objective: string;
  department: string;
  responsibleId: string;
  category: string;
  tags: string[];
}

export interface ProcessInsert {
  code: string;
  name: string;
  description: string | null;
  objective: string | null;
  department: string;
  responsibleId: string;
  category: string;
  status: "rascunho";
  currentVersion: string;
  bpmnXml: string;
  createdBy: string;
  tags: string[];
}

export interface ProcessWriteStore {
  codeExists(code: string): Promise<boolean>;
  profileExists(id: string): Promise<boolean>;
  insert(process: ProcessInsert): Promise<{ id: string }>;
  replaceTags(processId: string, tags: string[]): Promise<void>;
}

export function parseProcessForm(formData: FormData): CreateProcessInput | { error: string } {
  const code = readField(formData, "code").toUpperCase();
  const name = readField(formData, "name");
  const description = readField(formData, "description");
  const objective = readField(formData, "objective");
  const department = readField(formData, "department");
  const responsibleId = readField(formData, "responsibleId");
  const category = readField(formData, "category");
  const tags = parseTags(readField(formData, "tags"));

  if (!CODE_PATTERN.test(code)) {
    return { error: "Informe um código com 2 a 40 caracteres, usando letras, números, ponto, hífen ou sublinhado." };
  }

  if (name.length < 3 || name.length > 160) {
    return { error: "O nome do processo deve ter entre 3 e 160 caracteres." };
  }

  if (description.length > 4000 || objective.length > 4000) {
    return { error: "Descrição e objetivo podem ter no máximo 4000 caracteres." };
  }

  if (department.length < 2 || department.length > 120) {
    return { error: "Informe a unidade responsável." };
  }

  if (!isUuid(responsibleId)) {
    return { error: "Selecione o responsável do processo." };
  }

  if (category.length < 2 || category.length > 80) {
    return { error: "Informe a categoria do processo." };
  }

  if ("error" in tags) {
    return tags;
  }

  return {
    code,
    name,
    description,
    objective,
    department,
    responsibleId,
    category,
    tags,
  };
}

export function parseTags(value: string): string[] | { error: string } {
  const tags = [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];

  if (tags.length > 12) {
    return { error: "Use no máximo 12 tags." };
  }

  if (tags.some((tag) => tag.length > 40)) {
    return { error: "Cada tag pode ter no máximo 40 caracteres." };
  }

  return tags;
}

export function parseStatus(value: string): ProcessStatus | null {
  if (value === "rascunho" || value === "em_revisao" || value === "publicado" || value === "arquivado") {
    return value;
  }

  return null;
}

export async function createProcess(
  store: ProcessWriteStore,
  input: CreateProcessInput,
  actor: { id: string; role: UserRole },
): Promise<{ id: string }> {
  assertCan(actor.role, "create");

  if (!(await store.profileExists(input.responsibleId))) {
    throw new AppError("O responsável informado não existe.", "validation");
  }

  if (await store.codeExists(input.code)) {
    throw new AppError("Já existe um processo com este código.", "conflict");
  }

  const created = await store.insert({
    code: input.code,
    name: input.name,
    description: emptyToNull(input.description),
    objective: emptyToNull(input.objective),
    department: input.department,
    responsibleId: input.responsibleId,
    category: input.category,
    status: "rascunho",
    currentVersion: "1.0",
    bpmnXml: DEFAULT_BPMN_XML,
    createdBy: actor.id,
    tags: input.tags,
  });

  await store.replaceTags(created.id, input.tags);
  return created;
}

export function nextCopyCode(code: string, exists: (candidate: string) => boolean): string {
  const base = `${code}-COPIA`.slice(0, 40);
  if (!exists(base)) {
    return base;
  }

  let index = 2;
  while (exists(`${base.slice(0, 37)}-${index}`)) {
    index += 1;
  }

  return `${base.slice(0, 37)}-${index}`;
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}
