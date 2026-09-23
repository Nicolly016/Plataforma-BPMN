"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FLOW_TEXT_EXAMPLE, buildDiagramFromText } from "@/features/bpmn/utils/text-to-bpmn";

export function TextModelerPanel({ onApply, onClose }: { onApply: (xml: string) => void; onClose: () => void }) {
  const [text, setText] = useState(FLOW_TEXT_EXAMPLE);
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const result = buildDiagramFromText(text);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setText(result.text);
    setError(null);
    onApply(result.xml);
  }

  return (
    <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 lg:max-h-none lg:w-96 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-950">Escrever o fluxo</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <label className="flex min-h-0 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Passos do processo</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="min-h-48 w-full flex-1 border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-blue-800"
          />
        </label>
        <ul className="space-y-1 text-xs text-zinc-600">
          <li>Uma linha é uma tarefa. Recuo, decisão incompleta, nome repetido e retorno sem destino são ajustados ao modelar.</li>
          <li><span className="font-mono">raia Nome</span>, um título em maiúsculas, <span className="font-mono">[Nome] passo</span> ou <span className="font-mono">O compras analisa o pedido</span> criam a raia.</li>
          <li><span className="font-mono">A1. Título</span> seguido da descrição vira uma tarefa. Os números definem a ordem, e <span className="font-mono">Gateway:</span> abre a decisão.</li>
          <li><span className="font-mono">? pergunta</span> abre uma decisão. Abaixo, <span className="font-mono">sim: passo</span> e <span className="font-mono">não: passo</span>.</li>
          <li><span className="font-mono">+ nome</span> abre caminhos em paralelo.</li>
          <li><span className="font-mono">usuario:</span>, <span className="font-mono">servico:</span>, <span className="font-mono">manual:</span> ou <span className="font-mono">regra:</span> escolhem o tipo da tarefa.</li>
          <li><span className="font-mono">-&gt; nome</span> volta para um passo já escrito. <span className="font-mono">fim</span> encerra o caminho.</li>
        </ul>
        {error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        <p className="text-xs text-zinc-500">Modelar substitui o desenho atual.</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={apply} disabled={!text.trim()}>
            Modelar
          </Button>
          <Button onClick={() => { setText(FLOW_TEXT_EXAMPLE); setError(null); }}>Exemplo</Button>
        </div>
      </div>
    </aside>
  );
}
