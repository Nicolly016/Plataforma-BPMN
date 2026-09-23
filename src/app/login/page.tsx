import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getSession } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/env";

export default async function LoginPage() {
  const session = await getSession();

  if (session.status === "ready") {
    redirect("/dashboard");
  }

  const configured = Boolean(getSupabaseEnv());
  const profileMessage =
    session.status === "missing-profile"
      ? session.hint === "run-migration"
        ? "A conta autenticou, mas não há perfil no banco. No SQL Editor do Supabase, execute supabase/migrations/002_ensure_profile.sql e atualize esta página."
        : "A conta autenticou, mas o perfil não pôde ser lido. Atualize a página. Se o aviso continuar, execute supabase/migrations/002_ensure_profile.sql no SQL Editor."
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md border border-zinc-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Plataforma corporativa</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-950">Entrar</h1>
        <p className="mt-2 text-sm text-zinc-600">Acesse para modelar e documentar processos BPMN.</p>
        {profileMessage ? (
          <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{profileMessage}</p>
        ) : null}
        {configured ? <LoginForm /> : <SetupHelp />}
      </section>
    </main>
  );
}

function SetupHelp() {
  return (
    <div className="mt-5 space-y-3 text-sm text-zinc-700">
      <p>O Supabase ainda não está configurado neste ambiente.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Crie um projeto no Supabase.</li>
        <li>Execute o arquivo supabase/migrations/001_init.sql no SQL Editor.</li>
        <li>Copie .env.example para .env.local e preencha a URL e a chave anon.</li>
        <li>Crie um usuário em Authentication e promova o perfil: update public.profiles set role = &apos;administrador&apos; where email = &apos;seu-email&apos;;</li>
      </ol>
    </div>
  );
}
