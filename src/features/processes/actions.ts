"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppError, isRedirectError, toUserMessage } from "@/lib/errors";
import { assertCan } from "@/services/permissions.service";
import {
  archiveProcess,
  createProcessRecord,
  duplicateProcess,
  getProcess,
  updateProcessRecord,
} from "@/services/process-data";
import { parseProcessForm, parseStatus } from "@/features/processes/create-process";

export interface FormState {
  error?: string;
}

export async function createProcessAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseProcessForm(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    assertCan(user.role, "create");
    const created = await createProcessRecord(parsed, user);
    revalidatePath("/processos");
    revalidatePath("/dashboard");
    redirect(`/processos/${created.id}/modelador`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: toUserMessage(error) };
  }
}

export async function updateProcessAction(processId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseProcessForm(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    const current = await getProcess(processId);
    if (!current) {
      throw new AppError("Processo não encontrado.", "not_found");
    }

    assertCan(user.role, "edit", current.status);
    const requestedStatus = user.role === "administrador" ? parseStatus(read(formData, "status")) : null;
    const nextStatus = requestedStatus && requestedStatus !== current.status ? requestedStatus : null;

    if (nextStatus === "arquivado") {
      assertCan(user.role, "archive", current.status);
    }

    if (nextStatus === "publicado") {
      assertCan(user.role, "publish", current.status);
    }

    await updateProcessRecord(processId, parsed, nextStatus);
    revalidatePath("/processos");
    revalidatePath("/dashboard");
    revalidatePath(`/processos/${processId}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: toUserMessage(error) };
  }

  redirect(`/processos/${processId}`);
}

export async function archiveProcessAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const processId = read(formData, "processId");
  const current = await getProcess(processId);

  if (!current) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  assertCan(user.role, "archive", current.status);
  await archiveProcess(processId);
  revalidatePath("/processos");
  revalidatePath("/dashboard");
  revalidatePath(`/processos/${processId}`);
}

export async function duplicateProcessAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const processId = read(formData, "processId");
  const current = await getProcess(processId);

  if (!current) {
    throw new AppError("Processo não encontrado.", "not_found");
  }

  assertCan(user.role, "duplicate", current.status);
  const created = await duplicateProcess(processId, user);
  revalidatePath("/processos");
  revalidatePath("/dashboard");
  redirect(`/processos/${created.id}/modelador`);
}

function read(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
