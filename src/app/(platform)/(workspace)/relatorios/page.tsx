import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Relatórios" />
      <EmptyState title="Relatórios em preparação" description="Indicadores e comparações de versões serão adicionados depois que o modelador e a documentação estiverem estáveis." />
    </>
  );
}
