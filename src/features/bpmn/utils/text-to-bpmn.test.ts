import { describe, expect, it } from "vitest";
import { extractActivities, parseBpmnXml } from "@/features/bpmn/utils/bpmn.utils";
import { FLOW_TEXT_EXAMPLE, buildDiagramFromText } from "@/features/bpmn/utils/text-to-bpmn";

describe("texto para BPMN", () => {
  it("monta início, tarefas, decisão, retorno e fim", async () => {
    const result = buildDiagramFromText(FLOW_TEXT_EXAMPLE);
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    await parseBpmnXml(result.xml);
    const activities = await extractActivities(result.xml);
    expect(activities.map((activity) => activity.name)).toEqual([
      "receber solicitação",
      "analisar mérito",
      "pedir complemento",
      "emitir parecer",
    ]);
    expect(activities.find((activity) => activity.name === "analisar mérito")?.type).toBe("bpmn:UserTask");
    expect(result.xml).toContain('name="sim"');
    expect(result.xml).toContain('name="não"');
    expect(result.xml).toContain("exclusiveGateway");
    expect(result.xml).toContain("BPMNShape");
    expect(result.xml).toContain('name="Solicitante"');
    expect(result.xml).toContain('name="Compras"');
    expect(result.xml).toContain('name="Financeiro"');
    expect(result.xml).toContain("<bpmn:laneSet");
  });

  it("completa um fluxo linear com início e fim", async () => {
    const result = buildDiagramFromText("separar documentos\narquivar");
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    const activities = await extractActivities(result.xml);
    expect(activities.map((activity) => activity.name)).toEqual(["separar documentos", "arquivar"]);
    expect(result.xml).toContain('name="Início"');
    expect(result.xml).toContain('name="Fim"');
    expect(result.xml).not.toContain("<bpmn:laneSet");
  });

  it("modela caminhos paralelos", async () => {
    const result = buildDiagramFromText("+ conferir\n  documentos\n  pagamento\narquivar");
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    expect(result.xml).toContain("parallelGateway");
    const activities = await extractActivities(result.xml);
    expect(activities.map((activity) => activity.name)).toEqual(["documentos", "pagamento", "arquivar"]);
  });

  it("alinha recuo torto e continua a modelagem", async () => {
    const result = buildDiagramFromText(`receber solicitação
? documentos completos
  sim: usuario: analisar mérito
     registrar parecer
  não: pedir complemento
    -> receber solicitação
emitir parecer
fim`);
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    const activities = await extractActivities(result.xml);
    expect(activities.map((activity) => activity.name)).toEqual([
      "receber solicitação",
      "analisar mérito",
      "pedir complemento",
      "registrar parecer",
      "emitir parecer",
    ]);
    expect(result.text).toContain("    registrar parecer");
    expect(result.text).not.toMatch(/^     registrar parecer/m);
  });

  it("completa decisões incompletas, retorno sem destino e texto depois do fim", async () => {
    const decision = buildDiagramFromText("? aprovado\n  sim: seguir");
    expect("xml" in decision).toBe(true);
    if ("xml" in decision) {
      const activities = await extractActivities(decision.xml);
      expect(activities.map((activity) => activity.name)).toEqual(["aprovado", "seguir"]);
    }

    const missing = buildDiagramFromText("analisar\n-> publicar");
    expect("xml" in missing).toBe(true);
    if ("xml" in missing) {
      const activities = await extractActivities(missing.xml);
      expect(activities.map((activity) => activity.name)).toEqual(["analisar", "publicar"]);
    }

    const afterEnd = buildDiagramFromText("receber\nfim\narquivar");
    expect("xml" in afterEnd).toBe(true);
    if ("xml" in afterEnd) {
      const activities = await extractActivities(afterEnd.xml);
      expect(activities.map((activity) => activity.name)).toEqual(["receber", "arquivar"]);
    }

    expect(buildDiagramFromText("")).toEqual({ error: "Escreva ao menos um passo." });
  });

  it("entende frases, organiza o texto e desenha as raias", async () => {
    const result = buildDiagramFromText(`O solicitante envia a solicitação
O compras analisa os documentos
? pedido aprovado
  sim: O financeiro paga o fornecedor
  não: pedir correção
    -> envia a solicitação`);
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    await parseBpmnXml(result.xml);
    const activities = await extractActivities(result.xml);
    expect(activities.map((activity) => activity.name)).toEqual([
      "envia a solicitação",
      "analisa os documentos",
      "paga o fornecedor",
      "pedir correção",
    ]);
    expect(result.xml).toContain('name="Solicitante"');
    expect(result.xml).toContain('name="Compras"');
    expect(result.xml).toContain('name="Financeiro"');
    expect(result.xml).toContain('isHorizontal="true"');
    expect(result.text).toContain("raia Solicitante");
    expect(result.text).toContain("raia Compras");
    expect(result.text).toContain("[Financeiro] paga o fornecedor");
  });

  it("separa órgãos em raias, junta título e descrição e abre a decisão", async () => {
    const result = buildDiagramFromText(`ÓRGÃO LICITANTE

A1. Informar previsão de demanda de vagas
Informar à SEAP, durante o planejamento da contratação, a previsão de vagas destinadas a pessoas privadas de liberdade e/ou egressas.

A3. Incluir obrigação de contratação no edital e no contrato
Inserir no edital e na minuta de contrato a obrigação de contratação e as condições para cumprimento da reserva de vagas.

SEAP

A2. Emitir declaração de disponibilidade
Atestar a disponibilidade de pessoas privadas de liberdade e/ou egressas aptas, conforme o perfil das vagas.

A5. Confirmar disponibilidade para encaminhamento
Verificar, após a homologação, a existência de pessoas disponíveis com perfil compatível com as vagas.

Gateway:
Há trabalhador com perfil compatível?

A6. Emitir declaração de indisponibilidade
Emitir declaração de indisponibilidade quando não houver trabalhador com o perfil solicitado.

A7. Comunicar indisponibilidade ao órgão contratante
Comunicar ao órgão/entidade contratante a indisponibilidade de trabalhador para a vaga específica.

A9. Encaminhar nomes à empresa
Encaminhar à empresa contratada os nomes das pessoas disponíveis e aptas à contratação.

A11. Atualizar banco de dados
Registrar os trabalhadores contratados e manter atualizado o banco de dados da política de inclusão laboral.

ÓRGÃO/ENTIDADE CONTRATANTE

A4. Encaminhar informações do licitante vencedor à SEAP
Encaminhar à SEAP, em até 10 dias corridos, as informações da empresa vencedora e o perfil da mão de obra.

A8. Registrar dispensa da obrigação de contratação
Registrar a dispensa da obrigação de contratação para a vaga específica.

EMPRESA CONTRATADA

A10. Realizar seleção e formalizar contratação
Realizar a seleção e formalizar a contratação, observados os requisitos legais aplicáveis.

A12. Informar trabalhadores contratados à SEAP
Encaminhar à SEAP, em até 15 dias corridos, as informações dos trabalhadores contratados.`);
    expect("xml" in result).toBe(true);
    if (!("xml" in result)) {
      return;
    }

    await parseBpmnXml(result.xml);
    const activities = await extractActivities(result.xml);
    expect(activities).toHaveLength(12);
    expect(activities.map((activity) => activity.name)).not.toContain("Informar à SEAP, durante o planejamento da contratação, a previsão de vagas destinadas a pessoas privadas de liberdade e/ou egressas.");
    for (const code of ["A1.", "A2.", "A3.", "A4.", "A5.", "A6.", "A7.", "A8.", "A9.", "A10.", "A11.", "A12."]) {
      expect(activities.some((activity) => activity.name.startsWith(code))).toBe(true);
    }

    const rank = (prefix: string) => activities.findIndex((activity) => activity.name.startsWith(prefix));
    expect(rank("A1.")).toBeLessThan(rank("A2."));
    expect(rank("A2.")).toBeLessThan(rank("A3."));
    expect(rank("A4.")).toBeLessThan(rank("A5."));
    expect(rank("A5.")).toBeLessThan(rank("A6."));
    expect(rank("A5.")).toBeLessThan(rank("A9."));
    expect(result.xml).toContain('name="Órgão Licitante"');
    expect(result.xml).toContain('name="SEAP"');
    expect(result.xml).toContain('name="Órgão/Entidade Contratante"');
    expect(result.xml).toContain('name="Empresa Contratada"');
    expect(result.xml).toContain("exclusiveGateway");
    expect(result.xml).toContain('name="sim"');
    expect(result.xml).toContain('name="não"');
    expect(result.xml).toContain("pessoas privadas de liberdade");
    expect(result.text).toContain("raia Órgão Licitante");
    expect(result.text).toContain("raia SEAP");
    expect(result.text).toContain("> Informar à SEAP");

    const again = buildDiagramFromText(result.text);
    expect("xml" in again).toBe(true);
    if ("xml" in again) {
      const remodeled = await extractActivities(again.xml);
      expect(remodeled).toHaveLength(12);
      expect(again.xml).toContain('name="SEAP"');
      expect(again.xml).toContain('name="não"');
    }
  });
});
