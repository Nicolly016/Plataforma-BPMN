import { createProcess, nextCopyCode, type CreateProcessInput } from "@/features/processes/create-process";
import { saveDiagram, saveElementMetadata } from "@/features/bpmn/services/bpmn.service";
import { DEFAULT_BPMN_XML } from "@/features/bpmn/utils/default-diagram";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type {
  ElementMetadata,
  ProcessDetails,
  ProcessListItem,
  ProcessStatus,
  ProcessVersionItem,
  ProfileOption,
  UserRole,
} from "@/types/domain";
import { isProcessStatus, isUserRole } from "@/types/domain";
import { sanitizeSearch } from "@/utils/format";
import { isRecord, isUuid, readNullableString, readString } from "@/utils/guards";

export interface ProcessQuery {
  q?: string;
  department?: string;
  status?: string;
  responsibleId?: string;
  sort?: string;
}

export interface DashboardData {
  total: number;
  rascunho: number;
  emRevisao: number;
  publicado: number;
  arquivado: number;
  recentChanges: number;
  recent: ProcessListItem[];
}

interface DbError {
  message: string;
  code?: string;
}

const SORTS = {
  atualizado_desc: { column: "updated_at", ascending: false },
  atualizado_asc: { column: "updated_at", ascending: true },
  nome_asc: { column: "name", ascending: true },
  nome_desc: { column: "name", ascending: false },
  codigo_asc: { column: "code", ascending: true },
} as const;

export async function getDashboard(): Promise<DashboardData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [rascunho, emRevisao, publicado, arquivado, recentChanges, recentResult] = await Promise.all([
    countProcesses({ status: "rascunho" }),
    countProcesses({ status: "em_revisao" }),
    countProcesses({ status: "publicado" }),
    countProcesses({ status: "arquivado" }),
    countProcesses({ updatedSince: since }),
    supabase
      .from("processes")
      .select("id, code, name, department, responsible_id, category, status, current_version, updated_at")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  if (recentResult.error) {
    fail(recentResult.error);
  }

  const recent = await withResponsibleNames(asRows(recentResult.data).map(parseListItem));

  return {
    total: rascunho + emRevisao + publicado + arquivado,
    rascunho,
    emRevisao,
    publicado,
    arquivado,
    recentChanges,
    recent,
  };
}

export async function listProcesses(filters: ProcessQuery): Promise<ProcessListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("processes")
    .select("id, code, name, department, responsible_id, category, status, current_version, updated_at");
  const term = sanitizeSearch(filters.q ?? "");

  if (term) {
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  }

  if (filters.status && isProcessStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }

  if (filters.department) {
    query = query.eq("department", filters.department);
  }

  if (filters.responsibleId && isUuid(filters.responsibleId)) {
    query = query.eq("responsible_id", filters.responsibleId);
  }

  const sort = SORTS[filters.sort as keyof typeof SORTS] ?? SORTS.atualizado_desc;
  const result = await query.order(sort.column, { ascending: sort.ascending }).limit(200);

  if (result.error) {
    fail(result.error);
  }

  return withResponsibleNames(asRows(result.data).map(parseListItem));
}

export async function listFilterOptions(): Promise<{ departments: string[]; responsibles: ProfileOption[] }> {
  const supabase = await createClient();
  const [departmentsResult, profiles] = await Promise.all([
    supabase.from("processes").select("department"),
    listProfiles(),
  ]);

  if (departmentsResult.error) {
    fail(departmentsResult.error);
  }

  const departments = [...new Set(asRows(departmentsResult.data).map((row) => (isRecord(row) ? readString(row.department) : null)).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { departments, responsibles: profiles };
}

export async function getProcess(id: string): Promise<ProcessDetails | null> {
  if (!isUuid(id)) {
    return null;
  }

  const supabase = await createClient();
  const [processResult, tagsResult] = await Promise.all([
    supabase.from("processes").select("*").eq("id", id).maybeSingle(),
    supabase.from("process_tags").select("tag").eq("process_id", id),
  ]);

  if (processResult.error) {
    fail(processResult.error);
  }

  if (!processResult.data) {
    return null;
  }

  if (tagsResult.error) {
    fail(tagsResult.error);
  }

  const tags = asRows(tagsResult.data)
    .map((row) => (isRecord(row) ? readString(row.tag) : null))
    .filter((tag): tag is string => Boolean(tag));
  const details = parseDetails(processResult.data, tags);
  const [withName] = await withResponsibleNames([details]);
  return { ...details, responsibleName: withName?.responsibleName ?? null };
}

export async function listProfiles(): Promise<ProfileOption[]> {
  const supabase = await createClient();
  const result = await supabase.from("profiles").select("id, full_name, email, role, department").order("full_name");

  if (result.error) {
    fail(result.error);
  }

  return asRows(result.data).flatMap((row) => {
    const profile = parseProfile(row);
    return profile ? [profile] : [];
  });
}

export async function listElementMetadata(processId: string): Promise<ElementMetadata[]> {
  if (!isUuid(processId)) {
    return [];
  }

  const supabase = await createClient();
  const result = await supabase.from("process_element_metadata").select("*").eq("process_id", processId);

  if (result.error) {
    fail(result.error);
  }

  return asRows(result.data).map(parseMetadata);
}

export async function listVersions(processId: string): Promise<ProcessVersionItem[]> {
  if (!isUuid(processId)) {
    return [];
  }

  const supabase = await createClient();
  const result = await supabase
    .from("process_versions")
    .select("id, version_number, created_at, notes, created_by")
    .eq("process_id", processId)
    .order("created_at", { ascending: false });

  if (result.error) {
    fail(result.error);
  }

  const rows = asRows(result.data);
  const names = await loadNames(rows.map((row) => (isRecord(row) ? readString(row.created_by) : null)));

  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new AppError("Resposta inválida do banco.", "unavailable");
    }

    const id = readString(row.id);
    const versionNumber = readString(row.version_number);
    const createdAt = readString(row.created_at);
    const createdBy = readNullableString(row.created_by);

    if (!id || !versionNumber || !createdAt) {
      throw new AppError("Resposta inválida do banco.", "unavailable");
    }

    return {
      id,
      versionNumber,
      createdAt,
      notes: readNullableString(row.notes),
      createdByName: createdBy ? names.get(createdBy) ?? null : null,
    };
  });
}

export async function createProcessRecord(input: CreateProcessInput, actor: { id: string; role: UserRole }): Promise<{ id: string }> {
  const supabase = await createClient();

  return createProcess(
    {
      async codeExists(code) {
        return hasProcessCode(code);
      },
      async profileExists(id) {
        const result = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
        if (result.error) {
          fail(result.error);
        }
        return Boolean(result.data);
      },
      async insert(process) {
        const id = crypto.randomUUID();
        const result = await supabase.from("processes").insert({
          id,
          code: process.code,
          name: process.name,
          description: process.description,
          objective: process.objective,
          department: process.department,
          responsible_id: process.responsibleId,
          category: process.category,
          status: process.status,
          current_version: process.currentVersion,
          bpmn_xml: process.bpmnXml,
          created_by: process.createdBy,
        });

        if (result.error) {
          fail(result.error);
        }

        return { id };
      },
      async replaceTags(processId, tags) {
        await replaceProcessTags(processId, tags);
      },
    },
    input,
    actor,
  );
}

export async function updateProcessRecord(
  id: string,
  input: CreateProcessInput,
  status: ProcessStatus | null,
): Promise<void> {
  const supabase = await createClient();
  const current = await getProcess(id);

  if (!current) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  if (input.code !== current.code && (await hasProcessCode(input.code))) {
    throw new AppError("Já existe um processo com este código.", "conflict");
  }

  const profile = await supabase.from("profiles").select("id").eq("id", input.responsibleId).maybeSingle();
  if (profile.error) {
    fail(profile.error);
  }
  if (!profile.data) {
    throw new AppError("O responsável informado não existe.", "validation");
  }

  const patch: {
    code: string;
    name: string;
    description: string | null;
    objective: string | null;
    department: string;
    responsible_id: string;
    category: string;
    status?: ProcessStatus;
  } = {
    code: input.code,
    name: input.name,
    description: input.description || null,
    objective: input.objective || null,
    department: input.department,
    responsible_id: input.responsibleId,
    category: input.category,
  };

  if (status) {
    patch.status = status;
  }

  const result = await supabase.from("processes").update(patch).eq("id", id);
  if (result.error) {
    fail(result.error);
  }

  await replaceProcessTags(id, input.tags);
}

export async function archiveProcess(id: string): Promise<void> {
  const supabase = await createClient();
  const result = await supabase.from("processes").update({ status: "arquivado", archived_at: new Date().toISOString() }).eq("id", id);

  if (result.error) {
    fail(result.error);
  }
}

export async function duplicateProcess(id: string, actor: { id: string; role: UserRole }): Promise<{ id: string }> {
  const source = await getProcess(id);
  if (!source) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  const codes = await listCodes(`${source.code}%`);
  const code = nextCopyCode(source.code, (candidate) => codes.has(candidate));
  const created = await createProcessRecord(
    {
      code,
      name: `${source.name} (cópia)`.slice(0, 160),
      description: source.description,
      objective: source.objective,
      department: source.department,
      responsibleId: source.responsibleId ?? actor.id,
      category: source.category,
      tags: source.tags,
    },
    actor,
  );

  const supabase = await createClient();
  const xml = source.bpmnXml ?? DEFAULT_BPMN_XML;
  const update = await supabase.from("processes").update({ bpmn_xml: xml }).eq("id", created.id);
  if (update.error) {
    fail(update.error);
  }

  const metadata = await listElementMetadata(id);
  await Promise.all(metadata.map((item) => saveElementMetadataRecord(actor, created.id, item)));
  return created;
}

export async function saveProcessXml(actor: { role: UserRole }, processId: string, xml: string): Promise<void> {
  const supabase = await createClient();

  await saveDiagram(
    {
      async findProcess(targetId) {
        const result = await supabase.from("processes").select("id, status").eq("id", targetId).maybeSingle();
        if (result.error) {
          fail(result.error);
        }
        if (!isRecord(result.data)) {
          return null;
        }
        const status = readString(result.data.status);
        const idValue = readString(result.data.id);
        if (!idValue || !status || !isProcessStatus(status)) {
          return null;
        }
        return { id: idValue, status };
      },
      async saveXml(targetId, value) {
        const result = await supabase.from("processes").update({ bpmn_xml: value }).eq("id", targetId);
        if (result.error) {
          fail(result.error);
        }
      },
    },
    actor,
    processId,
    xml,
  );
}

export async function saveElementMetadataRecord(actor: { role: UserRole }, processId: string, metadata: ElementMetadata): Promise<void> {
  const supabase = await createClient();

  await saveElementMetadata(
    {
      async findProcess(targetId) {
        const result = await supabase.from("processes").select("id, status").eq("id", targetId).maybeSingle();
        if (result.error) {
          fail(result.error);
        }
        if (!isRecord(result.data)) {
          return null;
        }
        const status = readString(result.data.status);
        const idValue = readString(result.data.id);
        if (!idValue || !status || !isProcessStatus(status)) {
          return null;
        }
        return { id: idValue, status };
      },
      async upsert(targetId, value) {
        const result = await supabase.from("process_element_metadata").upsert(
          {
            process_id: targetId,
            bpmn_element_id: value.bpmnElementId,
            element_type: value.elementType,
            responsible: emptyToNull(value.responsible),
            department: emptyToNull(value.department),
            role: emptyToNull(value.role),
            description: emptyToNull(value.description),
            comment: emptyToNull(value.comment),
            documentation: emptyToNull(value.documentation),
            estimated_time: emptyToNull(value.estimatedTime),
            systems: emptyToNull(value.systems),
            channel: emptyToNull(value.channel),
            inputs: emptyToNull(value.inputs),
            outputs: emptyToNull(value.outputs),
            documents: emptyToNull(value.documents),
            risks: emptyToNull(value.risks),
            controls: emptyToNull(value.controls),
            regulations: emptyToNull(value.regulations),
            notes: emptyToNull(value.notes),
          },
          { onConflict: "process_id,bpmn_element_id" },
        );

        if (result.error) {
          fail(result.error);
        }
      },
    },
    actor,
    processId,
    metadata,
  );
}

export async function updateOwnProfile(userId: string, fullName: string, department: string): Promise<void> {
  const supabase = await createClient();
  const result = await supabase
    .from("profiles")
    .update({ full_name: fullName, department: department || null })
    .eq("id", userId);

  if (result.error) {
    fail(result.error);
  }
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const supabase = await createClient();
  const result = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (result.error) {
    fail(result.error);
  }
}

async function countProcesses(filter: { status?: ProcessStatus; updatedSince?: string }): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("processes").select("id", { count: "exact", head: true });

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.updatedSince) {
    query = query.gte("updated_at", filter.updatedSince);
  }

  const result = await query;
  if (result.error) {
    fail(result.error);
  }

  return result.count ?? 0;
}

async function hasProcessCode(code: string): Promise<boolean> {
  const supabase = await createClient();
  const result = await supabase.from("processes").select("id").eq("code", code).maybeSingle();
  if (result.error) {
    fail(result.error);
  }
  return Boolean(result.data);
}

async function listCodes(pattern: string): Promise<Set<string>> {
  const supabase = await createClient();
  const result = await supabase.from("processes").select("code").ilike("code", pattern);
  if (result.error) {
    fail(result.error);
  }

  return new Set(
    asRows(result.data)
      .map((row) => (isRecord(row) ? readString(row.code) : null))
      .filter((code): code is string => Boolean(code)),
  );
}

async function replaceProcessTags(processId: string, tags: string[]): Promise<void> {
  const supabase = await createClient();
  const deleted = await supabase.from("process_tags").delete().eq("process_id", processId);
  if (deleted.error) {
    fail(deleted.error);
  }

  if (tags.length === 0) {
    return;
  }

  const inserted = await supabase.from("process_tags").insert(tags.map((tag) => ({ process_id: processId, tag })));
  if (inserted.error) {
    fail(inserted.error);
  }
}

async function withResponsibleNames<T extends { responsibleId: string | null }>(items: T[]): Promise<Array<T & { responsibleName: string | null }>> {
  const names = await loadNames(items.map((item) => item.responsibleId));
  return items.map((item) => ({
    ...item,
    responsibleName: item.responsibleId ? names.get(item.responsibleId) ?? null : null,
  }));
}

async function loadNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const result = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (result.error) {
    fail(result.error);
  }

  const names = new Map<string, string>();
  for (const row of asRows(result.data)) {
    if (!isRecord(row)) {
      continue;
    }
    const id = readString(row.id);
    const name = readString(row.full_name);
    if (id && name) {
      names.set(id, name);
    }
  }

  return names;
}

function parseListItem(value: unknown): ProcessListItem {
  if (!isRecord(value)) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  const id = readString(value.id);
  const code = readString(value.code);
  const name = readString(value.name);
  const department = readString(value.department);
  const category = readString(value.category);
  const status = readString(value.status);
  const currentVersion = readString(value.current_version);
  const updatedAt = readString(value.updated_at);

  if (!id || !code || !name || !department || !category || !status || !isProcessStatus(status) || !currentVersion || !updatedAt) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  return {
    id,
    code,
    name,
    department,
    responsibleId: readNullableString(value.responsible_id),
    responsibleName: null,
    category,
    status,
    currentVersion,
    updatedAt,
  };
}

function parseDetails(value: unknown, tags: string[]): ProcessDetails {
  const base = parseListItem(value);
  if (!isRecord(value)) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  const createdAt = readString(value.created_at);
  if (!createdAt) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  return {
    ...base,
    description: readNullableString(value.description) ?? "",
    objective: readNullableString(value.objective) ?? "",
    tags,
    bpmnXml: readNullableString(value.bpmn_xml),
    createdBy: readNullableString(value.created_by),
    createdAt,
    archivedAt: readNullableString(value.archived_at),
  };
}

function parseProfile(value: unknown): ProfileOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const fullName = readString(value.full_name);
  const email = readString(value.email);
  const role = readString(value.role);

  if (!id || !fullName || !email || !role || !isUserRole(role)) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    role,
    department: readNullableString(value.department),
  };
}

function parseMetadata(value: unknown): ElementMetadata {
  if (!isRecord(value)) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  const bpmnElementId = readString(value.bpmn_element_id);
  const elementType = readString(value.element_type);

  if (!bpmnElementId || !elementType) {
    throw new AppError("Resposta inválida do banco.", "unavailable");
  }

  return {
    bpmnElementId,
    elementType,
    responsible: readNullableString(value.responsible) ?? "",
    department: readNullableString(value.department) ?? "",
    role: readNullableString(value.role) ?? "",
    description: readNullableString(value.description) ?? "",
    comment: readNullableString(value.comment) ?? "",
    documentation: readNullableString(value.documentation) ?? "",
    estimatedTime: readNullableString(value.estimated_time) ?? "",
    systems: readNullableString(value.systems) ?? "",
    channel: readNullableString(value.channel) ?? "",
    inputs: readNullableString(value.inputs) ?? "",
    outputs: readNullableString(value.outputs) ?? "",
    documents: readNullableString(value.documents) ?? "",
    risks: readNullableString(value.risks) ?? "",
    controls: readNullableString(value.controls) ?? "",
    regulations: readNullableString(value.regulations) ?? "",
    notes: readNullableString(value.notes) ?? "",
  };
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function fail(error: DbError): never {
  if (error.code === "23505") {
    throw new AppError("Já existe um registro com estes dados.", "conflict");
  }

  console.error(error.message);
  throw new AppError("Não foi possível acessar os dados.", "unavailable");
}
