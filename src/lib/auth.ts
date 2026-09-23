import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/env";
import type { AuthenticatedUser } from "@/types/domain";
import { isUserRole } from "@/types/domain";
import { isRecord, readNullableString, readString } from "@/utils/guards";

export type SessionState =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "missing-profile"; hint: "run-migration" | "create-failed" }
  | { status: "ready"; user: AuthenticatedUser };

export async function getSession(): Promise<SessionState> {
  if (!getSupabaseEnv()) {
    return { status: "unconfigured" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { status: "anonymous" };
  }

  let profileResult = await loadProfile(supabase, data.user.id);
  let hint: "run-migration" | "create-failed" = "run-migration";

  if (!profileResult.error && !profileResult.data) {
    const ensured = await supabase.rpc("ensure_own_profile");
    if (!ensured.error) {
      profileResult = await loadProfile(supabase, data.user.id);
      hint = "create-failed";
    } else if (!isMissingEnsureFunction(ensured.error)) {
      hint = "create-failed";
    }
  }

  if (profileResult.error) {
    hint = "create-failed";
  }

  if (profileResult.error || !profileResult.data) {
    return { status: "missing-profile", hint };
  }

  const user = parseUser(profileResult.data);
  if (!user) {
    return { status: "missing-profile", hint: "create-failed" };
  }

  return { status: "ready", user };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await getSession();

  if (session.status === "ready") {
    return session.user;
  }

  if (session.status === "missing-profile") {
    redirect("/login?perfil=ausente");
  }

  redirect("/login");
}

function loadProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase.from("profiles").select("id, email, full_name, role, department").eq("id", userId).maybeSingle();
}

function isMissingEnsureFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.message?.includes("ensure_own_profile") === true;
}

function parseUser(value: unknown): AuthenticatedUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const email = readString(value.email);
  const fullName = readString(value.full_name);
  const role = readString(value.role);

  if (!id || !email || !fullName || !role || !isUserRole(role)) {
    return null;
  }

  return {
    id,
    email,
    fullName,
    role,
    department: readNullableString(value.department),
  };
}
