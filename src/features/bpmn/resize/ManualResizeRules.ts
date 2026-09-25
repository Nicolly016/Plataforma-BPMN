import RuleProvider from "diagram-js/lib/features/rules/RuleProvider";
import type EventBus from "diagram-js/lib/core/EventBus";
import { evaluateManualResize, type Dimensions } from "@/features/bpmn/resize/resize-constraints";

interface ResizeContext {
  shape?: Parameters<typeof evaluateManualResize>[0];
  newBounds?: Dimensions;
}

const RULE_PRIORITY = 1500;

export default class ManualResizeRules extends RuleProvider {
  static $inject = ["eventBus"];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  init() {
    this.addRule("shape.resize", RULE_PRIORITY, (context: ResizeContext) => {
      return evaluateManualResize(context.shape, context.newBounds);
    });
  }
}
