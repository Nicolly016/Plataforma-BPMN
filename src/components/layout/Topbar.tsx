import { signOutAction } from "@/features/auth/actions";
import { ROLE_LABELS, type AuthenticatedUser } from "@/types/domain";

export function Topbar({ user }: { user: AuthenticatedUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <p className="text-sm text-zinc-500">Gestão de processos</p>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-900">{user.fullName}</p>
          <p className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="h-8 border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
