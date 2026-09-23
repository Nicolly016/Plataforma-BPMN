import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { updateRoleAction } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth";
import { listProfiles } from "@/services/process-data";
import { ROLE_LABELS, USER_ROLES } from "@/types/domain";

export const metadata = { title: "Administração" };

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "administrador") {
    redirect("/dashboard");
  }

  const profiles = await listProfiles();

  return (
    <>
      <PageHeader title="Administração" description="A alteração de perfil vale no servidor. A interface apenas não é suficiente para autorizar uma ação." />
      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">E-mail</th>
              <th className="px-3 py-2 font-medium">Unidade</th>
              <th className="px-3 py-2 font-medium">Perfil</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-zinc-200">
                <td className="px-3 py-3">{profile.fullName}</td>
                <td className="px-3 py-3">{profile.email}</td>
                <td className="px-3 py-3">{profile.department ?? "—"}</td>
                <td className="px-3 py-3">
                  <form action={updateRoleAction} className="flex gap-2">
                    <input type="hidden" name="userId" value={profile.id} />
                    <select name="role" defaultValue={profile.role} className="h-8 border border-zinc-300 bg-white px-2" aria-label={`Perfil de ${profile.fullName}`}>
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                    <button type="submit" className="h-8 border border-zinc-300 px-2">Salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
