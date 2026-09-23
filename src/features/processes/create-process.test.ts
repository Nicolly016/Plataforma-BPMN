import { describe, expect, it } from "vitest";
import { createProcess, nextCopyCode, parseProcessForm, parseTags } from "@/features/processes/create-process";
import type { ProcessInsert, ProcessWriteStore } from "@/features/processes/create-process";

const validForm = () => {
  const form = new FormData();
  form.set("code", "sol-01");
  form.set("name", "Solicitação de compras");
  form.set("description", "Recebe e analisa pedidos.");
  form.set("objective", "Padronizar a compra.");
  form.set("department", "Suprimentos");
  form.set("responsibleId", "22222222-2222-4222-8222-222222222222");
  form.set("category", "Administrativo");
  form.set("tags", "compras, urgente, compras");
  return form;
};

describe("criação de processo", () => {
  it("valida os campos e normaliza código e tags", () => {
    const parsed = parseProcessForm(validForm());
    expect(parsed).toMatchObject({
      code: "SOL-01",
      name: "Solicitação de compras",
      tags: ["compras", "urgente"],
    });
    expect(parseTags("a, a, b")).toEqual(["a", "b"]);
  });

  it("rejeita dados incompletos", () => {
    const form = validForm();
    form.set("name", "ab");
    expect(parseProcessForm(form)).toEqual({ error: "O nome do processo deve ter entre 3 e 160 caracteres." });
  });

  it("grava o processo em rascunho com o XML inicial e o autor da sessão", async () => {
    const inserted: ProcessInsert[] = [];
    const tags: string[][] = [];
    const store: ProcessWriteStore = {
      async codeExists() {
        return false;
      },
      async profileExists() {
        return true;
      },
      async insert(process) {
        inserted.push(process);
        return { id: "33333333-3333-4333-8333-333333333333" };
      },
      async replaceTags(_id, values) {
        tags.push(values);
      },
    };

    const parsed = parseProcessForm(validForm());
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }

    const actor = { id: "22222222-2222-4222-8222-222222222222", role: "editor" as const };
    const result = await createProcess(store, parsed, actor);

    expect(result.id).toBe("33333333-3333-4333-8333-333333333333");
    expect(inserted[0]?.createdBy).toBe(actor.id);
    expect(inserted[0]?.status).toBe("rascunho");
    expect(inserted[0]?.currentVersion).toBe("1.0");
    expect(inserted[0]?.bpmnXml).toContain("Nova atividade");
    expect(tags).toEqual([["compras", "urgente"]]);
  });

  it("impede visualizador de criar processo e código duplicado", async () => {
    const store: ProcessWriteStore = {
      async codeExists(code) {
        return code === "SOL-01";
      },
      async profileExists() {
        return true;
      },
      async insert() {
        throw new Error("não deveria inserir");
      },
      async replaceTags() {
        throw new Error("não deveria gravar tags");
      },
    };
    const parsed = parseProcessForm(validForm());
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }

    await expect(createProcess(store, parsed, { id: "22222222-2222-4222-8222-222222222222", role: "visualizador" })).rejects.toThrow(
      "Você não tem permissão para esta ação.",
    );
    await expect(createProcess(store, parsed, { id: "22222222-2222-4222-8222-222222222222", role: "administrador" })).rejects.toThrow(
      "Já existe um processo com este código.",
    );
  });

  it("gera um código único para a cópia", () => {
    expect(nextCopyCode("SOL-01", () => false)).toBe("SOL-01-COPIA");
    expect(nextCopyCode("SOL-01", (candidate) => candidate === "SOL-01-COPIA")).toBe("SOL-01-COPIA-2");
  });
});
