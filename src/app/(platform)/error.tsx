"use client";

import { Button } from "@/components/ui/Button";

export default function PlatformError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="m-6 border border-red-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-zinc-950">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-zinc-600">{error.message || "Ocorreu um erro inesperado."}</p>
      <div className="mt-4">
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </div>
  );
}
