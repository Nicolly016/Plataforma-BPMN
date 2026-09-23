import { describe, expect, it } from "vitest";
import { can } from "@/services/permissions.service";

describe("controle de permissões", () => {
  it("permite que o administrador gerencie o ciclo do processo", () => {
    expect(can("administrador", "create")).toBe(true);
    expect(can("administrador", "edit", "publicado")).toBe(true);
    expect(can("administrador", "archive", "publicado")).toBe(true);
    expect(can("administrador", "archive", "arquivado")).toBe(false);
    expect(can("administrador", "publish", "rascunho")).toBe(true);
    expect(can("administrador", "publish", "publicado")).toBe(false);
  });

  it("permite que o editor crie e edite, sem publicar ou arquivar", () => {
    expect(can("editor", "create")).toBe(true);
    expect(can("editor", "edit", "rascunho")).toBe(true);
    expect(can("editor", "edit", "em_revisao")).toBe(true);
    expect(can("editor", "edit", "arquivado")).toBe(false);
    expect(can("editor", "duplicate", "publicado")).toBe(true);
    expect(can("editor", "publish", "rascunho")).toBe(false);
    expect(can("editor", "archive", "rascunho")).toBe(false);
    expect(can("editor", "view", "rascunho")).toBe(true);
  });

  it("restringe o visualizador aos processos publicados", () => {
    expect(can("visualizador", "view", "publicado")).toBe(true);
    expect(can("visualizador", "view", "rascunho")).toBe(false);
    expect(can("visualizador", "view", "em_revisao")).toBe(false);
    expect(can("visualizador", "create")).toBe(false);
    expect(can("visualizador", "edit", "publicado")).toBe(false);
  });
});
