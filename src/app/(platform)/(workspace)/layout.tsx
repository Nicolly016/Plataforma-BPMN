import { Topbar } from "@/components/layout/Topbar";
import { requireUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar user={user} />
      <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
