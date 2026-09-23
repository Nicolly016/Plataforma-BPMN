"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { signInAction, type LoginState } from "@/features/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, {} as LoginState);

  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      {state.error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required minLength={6} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
