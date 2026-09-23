"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateProfileAction, type LoginState } from "@/features/auth/actions";
import { ROLE_LABELS, type AuthenticatedUser } from "@/types/domain";

export function SettingsForm({ user }: { user: AuthenticatedUser }) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as LoginState);

  return (
    <form action={action} className="grid max-w-xl gap-4 border border-zinc-200 bg-white p-5">
      {state.error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <Field label="Nome">
        <Input name="fullName" defaultValue={user.fullName} required maxLength={120} />
      </Field>
      <Field label="E-mail">
        <Input value={user.email} readOnly />
      </Field>
      <Field label="Unidade">
        <Input name="department" defaultValue={user.department ?? ""} maxLength={120} />
      </Field>
      <Field label="Perfil">
        <Input value={ROLE_LABELS[user.role]} readOnly />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}
