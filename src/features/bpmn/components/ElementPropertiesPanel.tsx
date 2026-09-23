"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { bpmnTypeLabel } from "@/features/bpmn/utils/bpmn.utils";
import { EMPTY_ELEMENT_METADATA, type ElementMetadata } from "@/types/domain";
import type { SelectedElement } from "@/features/bpmn/types/bpmn.types";

const GROUPS: Array<{ title: string; fields: Array<{ key: keyof typeof EMPTY_ELEMENT_METADATA; label: string; multiline?: boolean }> }> = [
  {
    title: "Geral",
    fields: [
      { key: "description", label: "Descrição", multiline: true },
      { key: "documentation", label: "Documentação", multiline: true },
    ],
  },
  {
    title: "Responsabilidade",
    fields: [
      { key: "responsible", label: "Responsável" },
      { key: "department", label: "Unidade responsável" },
      { key: "role", label: "Papel responsável" },
    ],
  },
  {
    title: "Execução",
    fields: [
      { key: "estimatedTime", label: "Prazo estimado" },
      { key: "systems", label: "Sistema utilizado" },
      { key: "channel", label: "Canal utilizado" },
    ],
  },
  {
    title: "Informações",
    fields: [
      { key: "inputs", label: "Entradas", multiline: true },
      { key: "outputs", label: "Saídas", multiline: true },
      { key: "documents", label: "Documentos necessários", multiline: true },
    ],
  },
  {
    title: "Governança",
    fields: [
      { key: "risks", label: "Riscos", multiline: true },
      { key: "controls", label: "Controles", multiline: true },
      { key: "regulations", label: "Normas relacionadas", multiline: true },
      { key: "notes", label: "Observações", multiline: true },
    ],
  },
];

export function ElementPropertiesPanel({
  element,
  metadata,
  onRename,
  onChange,
}: {
  element: SelectedElement | null;
  metadata: ElementMetadata | null;
  onRename: (name: string) => void;
  onChange: (metadata: ElementMetadata) => void;
}) {
  if (!element) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-zinc-200 bg-white p-4 lg:block">
        <h2 className="text-sm font-semibold text-zinc-900">Propriedades</h2>
        <p className="mt-3 text-sm text-zinc-500">Selecione um elemento no diagrama para documentar a atividade.</p>
      </aside>
    );
  }

  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white lg:block">
      <ElementForm key={`${element.id}:${element.name}`} element={element} metadata={metadata} onRename={onRename} onChange={onChange} />
    </aside>
  );
}

export function ElementPropertiesDrawer({
  element,
  metadata,
  onRename,
  onChange,
}: {
  element: SelectedElement | null;
  metadata: ElementMetadata | null;
  onRename: (name: string) => void;
  onChange: (metadata: ElementMetadata) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!element) {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 bg-white lg:hidden">
      <button type="button" className="h-10 w-full px-3 text-left text-sm font-medium" onClick={() => setOpen((value) => !value)}>
        {open ? "Ocultar propriedades" : `Propriedades · ${element.name || bpmnTypeLabel(element.type)}`}
      </button>
      {open ? <ElementForm key={`${element.id}:${element.name}`} element={element} metadata={metadata} onRename={onRename} onChange={onChange} /> : null}
    </div>
  );
}

function ElementForm({
  element,
  metadata,
  onRename,
  onChange,
}: {
  element: SelectedElement;
  metadata: ElementMetadata | null;
  onRename: (name: string) => void;
  onChange: (metadata: ElementMetadata) => void;
}) {
  const [name, setName] = useState(element.name);
  const current: ElementMetadata = metadata ?? { ...EMPTY_ELEMENT_METADATA, bpmnElementId: element.id, elementType: element.type };

  function update(key: keyof typeof EMPTY_ELEMENT_METADATA, value: string) {
    onChange({ ...current, bpmnElementId: element.id, elementType: element.type, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Propriedades</h2>
        <p className="mt-1 text-xs text-zinc-500">{element.id}</p>
      </div>
      <Field label="Nome">
        <Input
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onRename(name)}
        />
      </Field>
      <Field label="Tipo BPMN">
        <Input value={bpmnTypeLabel(element.type)} readOnly />
      </Field>
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3 border-t border-zinc-200 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.title}</h3>
          {group.fields.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.multiline ? (
                <Textarea value={current[field.key]} maxLength={4000} onChange={(event) => update(field.key, event.target.value)} />
              ) : (
                <Input value={current[field.key]} maxLength={4000} onChange={(event) => update(field.key, event.target.value)} />
              )}
            </Field>
          ))}
        </section>
      ))}
    </div>
  );
}
