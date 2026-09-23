import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-zinc-600">O processo não existe ou você não tem permissão para vê-lo.</p>
        <Link href="/processos" className="mt-4 inline-flex text-sm font-medium text-blue-800">Voltar aos processos</Link>
      </div>
    </main>
  );
}
