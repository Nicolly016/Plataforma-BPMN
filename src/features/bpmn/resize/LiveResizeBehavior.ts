import { getNewAttachPoint } from "diagram-js/lib/util/AttachUtil";
import { hasExternalLabel } from "bpmn-js/lib/util/LabelUtil";
import { isManuallyResizable, minDimensionsFor, type Dimensions } from "@/features/bpmn/resize/resize-constraints";

interface Point {
  x: number;
  y: number;
}

interface Waypoint extends Point {
  original?: Point;
}

interface Connection {
  source?: Shape;
  target?: Shape;
  waypoints: Waypoint[];
}

interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  waypoints?: unknown;
  label?: Shape;
  incoming?: Connection[];
  outgoing?: Connection[];
}

interface LiveContext {
  shape: Shape;
  newBounds?: Dimensions & Point;
  canExecute?: boolean;
  direction?: string;
  minDimensions?: Dimensions;
  live?: {
    bounds: Dimensions & Point;
    waypoints: Map<Connection, Point[]>;
    label?: Point;
  };
}

interface GraphicsFactory {
  update(type: "shape" | "connection", element: Shape | Connection, gfx: SVGElement): void;
}

interface ElementRegistry {
  getGraphics(element: Shape | Connection): SVGElement | undefined;
}

interface Outline {
  updateOutline(element: Shape | Connection, outline: SVGElement): void;
}

interface EventBus {
  on(event: string, priority: number, handler: (event: { context: LiveContext }) => void): void;
}

const MIN_PRIORITY = 1600;
const RESTORE_PRIORITY = 2000;
const MOVE_PRIORITY = 500;

export default function LiveResizeBehavior(
  eventBus: EventBus,
  graphicsFactory: GraphicsFactory,
  elementRegistry: ElementRegistry,
  outline: Outline,
) {
  eventBus.on("resize.start", MIN_PRIORITY, (event) => {
    const shape = event.context.shape;
    const min = minDimensionsFor(shape);
    if (min) {
      event.context.minDimensions = min;
    }
  });

  eventBus.on("resize.move", 1500, (event) => {
    const live = event.context.live;
    if (!live) {
      return;
    }

    revertGeometry(event.context.shape, live);
  });

  eventBus.on("resize.move", MOVE_PRIORITY, (event) => {
    const context = event.context;
    const shape = context.shape;
    if (!isManuallyResizable(shape)) {
      return;
    }

    if (!context.canExecute || !context.newBounds) {
      if (context.live) {
        revertGeometry(shape, context.live);
        redraw(shape, context.live, graphicsFactory, elementRegistry, outline);
      }
      return;
    }

    if (!context.live) {
      context.live = capture(shape);
    }

    applyLive(shape, context.newBounds, context.live);
    redraw(shape, context.live, graphicsFactory, elementRegistry, outline);
  });

  eventBus.on("resize.end", RESTORE_PRIORITY, (event) => {
    restore(event.context, graphicsFactory, elementRegistry, outline);
  });

  eventBus.on("resize.cancel", RESTORE_PRIORITY, (event) => {
    restore(event.context, graphicsFactory, elementRegistry, outline);
  });
}

LiveResizeBehavior.$inject = ["eventBus", "graphicsFactory", "elementRegistry", "outline"];

function capture(shape: Shape): NonNullable<LiveContext["live"]> {
  const waypoints = new Map<Connection, Point[]>();
  for (const connection of connectionsOf(shape)) {
    waypoints.set(
      connection,
      connection.waypoints.map((point) => ({ x: point.x, y: point.y })),
    );
  }

  const label = hasExternalLabel(shape as unknown as Parameters<typeof hasExternalLabel>[0]) && shape.label ? { x: shape.label.x, y: shape.label.y } : undefined;

  return {
    bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
    waypoints,
    label,
  };
}

function applyLive(shape: Shape, bounds: Dimensions & Point, live: NonNullable<LiveContext["live"]>) {
  shape.x = bounds.x;
  shape.y = bounds.y;
  shape.width = bounds.width;
  shape.height = bounds.height;

  for (const [connection, original] of live.waypoints) {
    if (connection.source === shape) {
      const anchor = getNewAttachPoint(original[0], live.bounds, bounds);
      connection.waypoints[0].x = anchor.x;
      connection.waypoints[0].y = anchor.y;
    }

    if (connection.target === shape) {
      const anchor = getNewAttachPoint(original[original.length - 1], live.bounds, bounds);
      const point = connection.waypoints[connection.waypoints.length - 1];
      point.x = anchor.x;
      point.y = anchor.y;
    }
  }

  if (live.label && shape.label) {
    const dx = bounds.x + bounds.width / 2 - (live.bounds.x + live.bounds.width / 2);
    const dy = bounds.y + bounds.height - (live.bounds.y + live.bounds.height);
    shape.label.x = live.label.x + dx;
    shape.label.y = live.label.y + dy;
  }
}

function revertGeometry(shape: Shape, live: NonNullable<LiveContext["live"]>) {
  shape.x = live.bounds.x;
  shape.y = live.bounds.y;
  shape.width = live.bounds.width;
  shape.height = live.bounds.height;

  for (const [connection, original] of live.waypoints) {
    if (connection.source === shape) {
      connection.waypoints[0].x = original[0].x;
      connection.waypoints[0].y = original[0].y;
    }

    if (connection.target === shape) {
      const last = original.length - 1;
      const point = connection.waypoints[connection.waypoints.length - 1];
      point.x = original[last].x;
      point.y = original[last].y;
    }
  }

  if (live.label && shape.label) {
    shape.label.x = live.label.x;
    shape.label.y = live.label.y;
  }
}

function restore(
  context: LiveContext,
  graphicsFactory: GraphicsFactory,
  elementRegistry: ElementRegistry,
  outline: Outline,
) {
  const live = context.live;
  if (!live) {
    return;
  }

  context.live = undefined;
  revertGeometry(context.shape, live);

  redraw(context.shape, live, graphicsFactory, elementRegistry, outline);
}

function redraw(
  shape: Shape,
  live: NonNullable<LiveContext["live"]>,
  graphicsFactory: GraphicsFactory,
  elementRegistry: ElementRegistry,
  outline: Outline,
) {
  paint(shape, graphicsFactory, elementRegistry, outline);

  if (shape.label) {
    paint(shape.label, graphicsFactory, elementRegistry, outline);
  }

  for (const connection of live.waypoints.keys()) {
    paint(connection, graphicsFactory, elementRegistry, outline);
  }
}

function paint(
  element: Shape | Connection,
  graphicsFactory: GraphicsFactory,
  elementRegistry: ElementRegistry,
  outline: Outline,
) {
  const gfx = elementRegistry.getGraphics(element);
  if (!gfx) {
    return;
  }

  graphicsFactory.update("waypoints" in element ? "connection" : "shape", element, gfx);
  const outlineGfx = gfx.querySelector(".djs-outline");
  if (outlineGfx instanceof SVGElement) {
    outline.updateOutline(element, outlineGfx);
  }
}

function connectionsOf(shape: Shape): Connection[] {
  const seen = new Set<Connection>();
  const list: Connection[] = [];
  for (const connection of [...(shape.incoming ?? []), ...(shape.outgoing ?? [])]) {
    if (!seen.has(connection)) {
      seen.add(connection);
      list.push(connection);
    }
  }
  return list;
}
