import { describe, expect, it } from "vitest";
import {
  DATA_OBJECT_MIN_DIMENSIONS,
  DATA_STORE_MIN_DIMENSIONS,
  EVENT_MIN_DIMENSIONS,
  GATEWAY_MIN_DIMENSIONS,
  TASK_MIN_DIMENSIONS,
  allowsResizeBounds,
  evaluateManualResize,
  minDimensionsFor,
} from "@/features/bpmn/resize/resize-constraints";

function shape(types: string[]) {
  return {
    businessObject: {
      $instanceOf(type: string) {
        return types.includes(type);
      },
    },
  };
}

describe("redimensionamento manual", () => {
  it("define o mínimo de tarefas em 80 por 50", () => {
    const task = shape(["bpmn:Task", "bpmn:Activity"]);
    expect(minDimensionsFor(task)).toEqual(TASK_MIN_DIMENSIONS);
    expect(evaluateManualResize(task)).toBe(true);
    expect(evaluateManualResize(task, { width: 80, height: 50 })).toBe(true);
    expect(evaluateManualResize(task, { width: 79, height: 50 })).toBe(false);
    expect(evaluateManualResize(task, { width: 80, height: 49 })).toBe(false);
  });

  it("impede largura e altura não positivas", () => {
    expect(allowsResizeBounds(TASK_MIN_DIMENSIONS, { width: -10, height: 80 })).toBe(false);
    expect(allowsResizeBounds(TASK_MIN_DIMENSIONS, { width: 100, height: 0 })).toBe(false);
    expect(allowsResizeBounds(EVENT_MIN_DIMENSIONS, { width: Number.NaN, height: 30 })).toBe(false);
  });

  it("aplica mínimos próprios a evento, gateway e dados", () => {
    expect(minDimensionsFor(shape(["bpmn:StartEvent", "bpmn:Event"]))).toEqual(EVENT_MIN_DIMENSIONS);
    expect(minDimensionsFor(shape(["bpmn:ExclusiveGateway", "bpmn:Gateway"]))).toEqual(GATEWAY_MIN_DIMENSIONS);
    expect(minDimensionsFor(shape(["bpmn:DataObjectReference", "bpmn:DataObject"]))).toEqual(DATA_OBJECT_MIN_DIMENSIONS);
    expect(minDimensionsFor(shape(["bpmn:DataStoreReference"]))).toEqual(DATA_STORE_MIN_DIMENSIONS);
  });

  it("deixa raias e subprocessos expandidos com as regras padrão", () => {
    const lane = shape(["bpmn:Lane"]);
    const expanded = {
      ...shape(["bpmn:SubProcess", "bpmn:Activity"]),
      di: { isExpanded: true, $instanceOf: () => false },
    };

    expect(evaluateManualResize(lane)).toBeUndefined();
    expect(evaluateManualResize(expanded, { width: 200, height: 120 })).toBeUndefined();
  });

  it("permite redimensionar subprocesso recolhido como tarefa", () => {
    const collapsed = {
      ...shape(["bpmn:SubProcess", "bpmn:Activity"]),
      di: { isExpanded: false },
    };

    expect(minDimensionsFor(collapsed)).toEqual(TASK_MIN_DIMENSIONS);
  });

  it("ignora rótulos e conexões", () => {
    expect(evaluateManualResize({ type: "label", labelTarget: {} })).toBeUndefined();
    expect(evaluateManualResize({ waypoints: [], type: "bpmn:SequenceFlow" })).toBeUndefined();
  });
});
