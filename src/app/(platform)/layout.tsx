import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (session.status === "anonymous" || session.status === "unconfigured") {
    redirect("/login");
  }

  if (session.status === "missing-profile") {
    redirect("/login?perfil=ausente");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100 text-zinc-900">
      <Sidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
