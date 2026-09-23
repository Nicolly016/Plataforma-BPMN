"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/env";

export interface LoginState {
  error?: string;
}

export async function signInAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!getSupabaseEnv()) {
    return { error: "Configure o Supabase antes de entrar." };
  }

  const email = read(formData, "email");
  const password = read(formData, "password");

  if (!email.includes("@") || password.length < 6) {
    return { error: "Informe um e-mail válido e a senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function updateProfileAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const { requireUser } = await import("@/lib/auth");
  const { updateOwnProfile } = await import("@/services/process-data");
  const { toUserMessage } = await import("@/lib/errors");
  const user = await requireUser();
  const fullName = read(formData, "fullName");
  const department = read(formData, "department");

  if (fullName.length < 3 || fullName.length > 120) {
    return { error: "Informe seu nome com 3 a 120 caracteres." };
  }

  if (department.length > 120) {
    return { error: "A unidade pode ter no máximo 120 caracteres." };
  }

  try {
    await updateOwnProfile(user.id, fullName, department);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: toUserMessage(error) };
  }

  redirect("/configuracoes");
}

export async function updateRoleAction(formData: FormData): Promise<void> {
  const { requireUser } = await import("@/lib/auth");
  const { updateUserRole } = await import("@/services/process-data");
  const { assertCan } = await import("@/services/permissions.service");
  const { isUserRole } = await import("@/types/domain");
  const { isUuid } = await import("@/utils/guards");
  const { AppError } = await import("@/lib/errors");
  const user = await requireUser();

  if (user.role !== "administrador") {
    throw new AppError("Apenas administradores podem alterar perfis de acesso.", "forbidden");
  }

  const userId = read(formData, "userId");
  const role = read(formData, "role");

  if (!isUuid(userId) || !isUserRole(role)) {
    throw new AppError("Dados de perfil inválidos.", "validation");
  }

  assertCan(user.role, "view");
  await updateUserRole(userId, role);
  redirect("/administracao");
}

function read(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
