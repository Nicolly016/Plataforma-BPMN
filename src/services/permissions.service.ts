import type { ProcessAction, ProcessStatus, UserRole } from "@/types/domain";
import { AppError } from "@/lib/errors";

export function can(role: UserRole, action: ProcessAction, status?: ProcessStatus): boolean {
  if (role === "administrador") {
    if (action === "archive") {
      return status !== "arquivado";
    }

    if (action === "publish") {
      return status !== undefined && status !== "publicado" && status !== "arquivado";
    }

    return true;
  }

  if (role === "editor") {
    if (action === "view" || action === "create") {
      return true;
    }

    if (action === "edit" || action === "duplicate") {
      return status !== "arquivado";
    }

    return false;
  }

  return action === "view" && status === "publicado";
}

export function assertCan(role: UserRole, action: ProcessAction, status?: ProcessStatus): void {
  if (!can(role, action, status)) {
    throw new AppError("Você não tem permissão para esta ação.", "forbidden");
  }
}
