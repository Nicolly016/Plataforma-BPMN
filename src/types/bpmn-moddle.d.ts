declare module "bpmn-moddle" {
  export interface BpmnModdleElement {
    $type: string;
    id?: string;
    name?: string;
    flowElements?: BpmnModdleElement[];
    rootElements?: BpmnModdleElement[];
    sourceRef?: BpmnModdleElement | string;
    targetRef?: BpmnModdleElement | string;
  }

  export interface BpmnParseResult {
    rootElement: BpmnModdleElement;
  }

  export interface BpmnModdleInstance {
    fromXML(xml: string): Promise<BpmnParseResult>;
  }

  export function BpmnModdle(): BpmnModdleInstance;
}
