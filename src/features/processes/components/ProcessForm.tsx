"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { FormState } from "@/features/processes/actions";
import { STATUS_LABELS, type ProcessDetails, type ProcessStatus, type ProfileOption } from "@/types/domain";

export function ProcessForm({
  action,
  profiles,
  process,
  allowStatus,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  profiles: ProfileOption[];
  process?: ProcessDetails;
  allowStatus?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid max-w-3xl gap-4 border border-zinc-200 bg-white p-5">
      {state.error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Código do processo">
          <Input name="code" defaultValue={process?.code ?? ""} required maxLength={40} />
        </Field>
        <Field label="Categoria">
          <Input name="category" defaultValue={process?.category ?? ""} required maxLength={80} />
        </Field>
      </div>
      <Field label="Nome do processo">
        <Input name="name" defaultValue={process?.name ?? ""} required maxLength={160} />
      </Field>
      <Field label="Descrição">
        <Textarea name="description" defaultValue={process?.description ?? ""} maxLength={4000} />
      </Field>
      <Field label="Objetivo">
        <Textarea name="objective" defaultValue={process?.objective ?? ""} maxLength={4000} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Unidade responsável">
          <Input name="department" defaultValue={process?.department ?? ""} required maxLength={120} />
        </Field>
        <Field label="Responsável">
          <Select name="responsibleId" defaultValue={process?.responsibleId ?? ""} required>
            <option value="">Selecione</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Tags" hint="Separe as tags por vírgula.">
        <Input name="tags" defaultValue={process?.tags.join(", ") ?? ""} />
      </Field>
      {allowStatus && process ? (
        <Field label="Status">
          <Select name="status" defaultValue={process.status}>
            {(Object.keys(STATUS_LABELS) as ProcessStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
