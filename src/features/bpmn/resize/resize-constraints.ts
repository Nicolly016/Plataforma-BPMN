import { is, isAny } from "bpmn-js/lib/util/ModelUtil";
import { isExpanded } from "bpmn-js/lib/util/DiUtil";

export interface Dimensions {
  width: number;
  height: number;
}

export const TASK_MIN_DIMENSIONS: Dimensions = { width: 80, height: 50 };
export const EVENT_MIN_DIMENSIONS: Dimensions = { width: 24, height: 24 };
export const GATEWAY_MIN_DIMENSIONS: Dimensions = { width: 36, height: 36 };
export const DATA_OBJECT_MIN_DIMENSIONS: Dimensions = { width: 28, height: 36 };
export const DATA_STORE_MIN_DIMENSIONS: Dimensions = { width: 36, height: 40 };

const RESIZABLE_TYPES = [
  "bpmn:Activity",
  "bpmn:Event",
  "bpmn:Gateway",
  "bpmn:DataObject",
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
];

interface BpmnShape {
  type?: string;
  waypoints?: unknown;
  labelTarget?: unknown;
  businessObject?: { $instanceOf?: (type: string) => boolean };
}

export function isManuallyResizable(shape: BpmnShape | null | undefined): boolean {
  if (!shape || shape.waypoints || shape.labelTarget || shape.type === "label") {
    return false;
  }

  if (is(shape, "bpmn:SubProcess") && isExpanded(shape as Parameters<typeof isExpanded>[0])) {
    return false;
  }

  return isAny(shape, RESIZABLE_TYPES);
}

export function minDimensionsFor(shape: BpmnShape | null | undefined): Dimensions | null {
  if (!isManuallyResizable(shape) || !shape) {
    return null;
  }

  if (is(shape, "bpmn:Event")) {
    return EVENT_MIN_DIMENSIONS;
  }

  if (is(shape, "bpmn:Gateway")) {
    return GATEWAY_MIN_DIMENSIONS;
  }

  if (is(shape, "bpmn:DataStoreReference")) {
    return DATA_STORE_MIN_DIMENSIONS;
  }

  if (is(shape, "bpmn:DataObject") || is(shape, "bpmn:DataObjectReference")) {
    return DATA_OBJECT_MIN_DIMENSIONS;
  }

  return TASK_MIN_DIMENSIONS;
}

export function allowsResizeBounds(min: Dimensions, bounds: Dimensions | null | undefined): boolean {
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return false;
  }

  return bounds.width >= min.width && bounds.height >= min.height && bounds.width > 0 && bounds.height > 0;
}

export function evaluateManualResize(shape: BpmnShape | null | undefined, newBounds?: Dimensions | null): boolean | undefined {
  const min = minDimensionsFor(shape);
  if (!min) {
    return undefined;
  }

  if (!newBounds) {
    return true;
  }

  return allowsResizeBounds(min, newBounds);
}
