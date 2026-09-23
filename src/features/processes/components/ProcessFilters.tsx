import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { STATUS_LABELS, type ProfileOption } from "@/types/domain";

export function ProcessFilters({
  departments,
  responsibles,
  values,
}: {
  departments: string[];
  responsibles: ProfileOption[];
  values: { q: string; department: string; status: string; responsibleId: string; sort: string };
}) {
  return (
    <form className="mb-4 grid gap-3 border border-zinc-200 bg-white p-4 md:grid-cols-6">
      <div className="md:col-span-2">
        <Field label="Pesquisar">
          <Input name="q" defaultValue={values.q} placeholder="Nome ou código" />
        </Field>
      </div>
      <Field label="Área">
        <Select name="department" defaultValue={values.department}>
          <option value="">Todas</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={values.status}>
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Responsável">
        <Select name="responsibleId" defaultValue={values.responsibleId}>
          <option value="">Todos</option>
          {responsibles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ordenar">
        <Select name="sort" defaultValue={values.sort || "atualizado_desc"}>
          <option value="atualizado_desc">Atualização mais recente</option>
          <option value="atualizado_asc">Atualização mais antiga</option>
          <option value="nome_asc">Nome</option>
          <option value="nome_desc">Nome decrescente</option>
          <option value="codigo_asc">Código</option>
        </Select>
      </Field>
      <div className="md:col-span-6">
        <Button type="submit" variant="primary">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
