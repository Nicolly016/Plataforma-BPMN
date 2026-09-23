import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsForm } from "@/features/auth/components/SettingsForm";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Configurações" description="Dados do seu perfil. O perfil de acesso só pode ser alterado por um administrador." />
      <SettingsForm user={user} />
    </>
  );
}
