import { describe, expect, it } from "vitest";
import { DEFAULT_BPMN_XML } from "@/features/bpmn/utils/default-diagram";
import {
  buildExportFileName,
  extractActivities,
  isBpmnFilename,
  parseBpmnXml,
  resolveShortcut,
} from "@/features/bpmn/utils/bpmn.utils";
import { saveDiagram, saveElementMetadata } from "@/features/bpmn/services/bpmn.service";
import type { ElementMetadata } from "@/types/domain";

const metadata: ElementMetadata = {
  bpmnElementId: "Activity_1",
  elementType: "bpmn:Task",
  responsible: "Ana",
  department: "Operações",
  role: "Analista",
  description: "Analisar a demanda",
  documentation: "Registrar a decisão",
  estimatedTime: "2 dias",
  systems: "ERP",
  channel: "Portal",
  inputs: "Solicitação",
  outputs: "Parecer",
  documents: "Formulário",
  risks: "Atraso",
  controls: "Checklist",
  regulations: "Norma interna",
  notes: "Prioridade média",
};

describe("BPMN", () => {
  it("carrega o diagrama inicial com início, atividade e fim", async () => {
    const root = await parseBpmnXml(DEFAULT_BPMN_XML);
    const activities = await extractActivities(DEFAULT_BPMN_XML);

    expect(root.$type).toBe("bpmn:Definitions");
    expect(activities).toEqual([
      expect.objectContaining({
        order: 1,
        id: "Activity_1",
        name: "Nova atividade",
        type: "bpmn:Task",
      }),
    ]);
  });

  it("rejeita XML inválido sem descartar a validação", async () => {
    await expect(parseBpmnXml("<xml />")).rejects.toThrow("Não foi possível interpretar o XML BPMN.");
  });

  it("lê as tarefas na ordem do fluxo", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1">
        <bpmn:process id="Process_1">
          <bpmn:startEvent id="Start_1" />
          <bpmn:userTask id="Task_A" name="Análise" />
          <bpmn:exclusiveGateway id="Gateway_1" />
          <bpmn:serviceTask id="Task_B" name="Execução" />
          <bpmn:endEvent id="End_1" />
          <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_A" />
          <bpmn:sequenceFlow id="F2" sourceRef="Task_A" targetRef="Gateway_1" />
          <bpmn:sequenceFlow id="F3" sourceRef="Gateway_1" targetRef="Task_B" />
          <bpmn:sequenceFlow id="F4" sourceRef="Task_B" targetRef="End_1" />
        </bpmn:process>
      </bpmn:definitions>`;

    const activities = await extractActivities(xml);
    expect(activities.map((activity) => activity.name)).toEqual(["Análise", "Execução"]);
    expect(activities.map((activity) => activity.typeLabel)).toEqual(["Tarefa de usuário", "Tarefa de serviço"]);
  });

  it("salva o XML somente para quem pode editar", async () => {
    const saved: string[] = [];
    const store = {
      async findProcess() {
        return { id: "11111111-1111-4111-8111-111111111111", status: "rascunho" as const };
      },
      async saveXml(_id: string, xml: string) {
        saved.push(xml);
      },
    };

    await saveDiagram(store, { role: "editor" }, "11111111-1111-4111-8111-111111111111", DEFAULT_BPMN_XML);
    expect(saved).toHaveLength(1);

    await expect(
      saveDiagram(store, { role: "visualizador" }, "11111111-1111-4111-8111-111111111111", DEFAULT_BPMN_XML),
    ).rejects.toThrow("Você não tem permissão para esta ação.");
    expect(saved).toHaveLength(1);
  });

  it("não grava XML inválido", async () => {
    const store = {
      async findProcess() {
        return { id: "11111111-1111-4111-8111-111111111111", status: "rascunho" as const };
      },
      async saveXml() {
        throw new Error("não deveria gravar");
      },
    };

    await expect(
      saveDiagram(store, { role: "administrador" }, "11111111-1111-4111-8111-111111111111", "<quebrado />"),
    ).rejects.toThrow("Não foi possível interpretar o XML BPMN.");
  });

  it("persiste os metadados do elemento usando o id BPMN", async () => {
    const rows: ElementMetadata[] = [];
    const store = {
      async findProcess() {
        return { id: "11111111-1111-4111-8111-111111111111", status: "em_revisao" as const };
      },
      async upsert(_processId: string, value: ElementMetadata) {
        rows.push(value);
      },
    };

    await saveElementMetadata(store, { role: "editor" }, "11111111-1111-4111-8111-111111111111", metadata);
    expect(rows[0]?.bpmnElementId).toBe("Activity_1");
    expect(rows[0]?.documentation).toBe("Registrar a decisão");

    await expect(
      saveElementMetadata(
        { ...store, async findProcess() { return { id: "11111111-1111-4111-8111-111111111111", status: "arquivado" as const }; } },
        { role: "editor" },
        "11111111-1111-4111-8111-111111111111",
        metadata,
      ),
    ).rejects.toThrow("Você não tem permissão para esta ação.");
  });

  it("monta um nome de arquivo amigável e reconhece atalhos", () => {
    expect(buildExportFileName("Solicitação de Compras", "1.2", "bpmn")).toBe("processo-solicitacao-de-compras-v1.2.bpmn");
    expect(isBpmnFilename("fluxo.bpmn")).toBe(true);
    expect(isBpmnFilename("fluxo.txt")).toBe(false);
    expect(resolveShortcut({ key: "s", ctrlKey: true, metaKey: false, shiftKey: false, targetIsField: false })).toBe("save");
    expect(resolveShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, targetIsField: false })).toBe("undo");
    expect(resolveShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: true, targetIsField: false })).toBe("redo");
    expect(resolveShortcut({ key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false, targetIsField: true })).toBeNull();
  });
});
