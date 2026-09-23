import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { getSupabaseEnv } from "@/lib/env";

export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new AppError("O Supabase ainda não foi configurado.", "unavailable");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Em Server Components o cookie é renovado pelo proxy.
        }
      },
    },
  });
}
