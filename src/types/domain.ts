export const USER_ROLES = ["administrador", "editor", "visualizador"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  administrador: "Administrador",
  editor: "Editor",
  visualizador: "Visualizador",
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

export const PROCESS_STATUSES = ["rascunho", "em_revisao", "publicado", "arquivado"] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export const STATUS_LABELS: Record<ProcessStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export function isProcessStatus(value: string): value is ProcessStatus {
  return PROCESS_STATUSES.some((status) => status === value);
}

export const PROCESS_ACTIONS = ["view", "create", "edit", "duplicate", "archive", "publish"] as const;
export type ProcessAction = (typeof PROCESS_ACTIONS)[number];

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string | null;
}

export interface ProcessListItem {
  id: string;
  code: string;
  name: string;
  department: string;
  responsibleId: string | null;
  responsibleName: string | null;
  category: string;
  status: ProcessStatus;
  currentVersion: string;
  updatedAt: string;
}

export interface ProcessDetails extends ProcessListItem {
  description: string;
  objective: string;
  tags: string[];
  bpmnXml: string | null;
  createdBy: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface ProfileOption {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string | null;
}

export interface ElementMetadata {
  bpmnElementId: string;
  elementType: string;
  responsible: string;
  department: string;
  role: string;
  description: string;
  documentation: string;
  estimatedTime: string;
  systems: string;
  channel: string;
  inputs: string;
  outputs: string;
  documents: string;
  risks: string;
  controls: string;
  regulations: string;
  notes: string;
}

export interface ProcessVersionItem {
  id: string;
  versionNumber: string;
  createdAt: string;
  notes: string | null;
  createdByName: string | null;
}

export interface ProcessActivity {
  order: number;
  id: string;
  name: string;
  type: string;
  typeLabel: string;
}

export const EMPTY_ELEMENT_METADATA: Omit<ElementMetadata, "bpmnElementId" | "elementType"> = {
  responsible: "",
  department: "",
  role: "",
  description: "",
  documentation: "",
  estimatedTime: "",
  systems: "",
  channel: "",
  inputs: "",
  outputs: "",
  documents: "",
  risks: "",
  controls: "",
  regulations: "",
  notes: "",
};
