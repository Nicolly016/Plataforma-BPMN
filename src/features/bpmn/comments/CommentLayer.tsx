"use client";

import { MessageSquareText } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { placeCommentTooltip, visibleComment, type TooltipRect } from "@/features/bpmn/comments/comment-tooltip";

interface DiagramElement {
  id: string;
  type?: string;
  waypoints?: unknown;
  labelTarget?: DiagramElement;
}

interface OverlayApi {
  get(filter: { type: string }): Array<{ id: string }>;
  add(elementId: string, type: string, overlay: { position: { top: number; right: number }; html: HTMLElement }): string;
  remove(id: string): void;
}

interface ElementRegistry {
  get(id: string): DiagramElement | undefined;
  getGraphics(element: DiagramElement): SVGElement | undefined;
}

export interface DiagramHost {
  on(event: string, handler: (event: { element?: DiagramElement }) => void): void;
  off(event: string, handler: (event: { element?: DiagramElement }) => void): void;
  get(name: "overlays"): OverlayApi;
  get(name: "elementRegistry"): ElementRegistry;
}

interface TooltipState {
  text: string;
  anchor: TooltipRect;
}

export function CommentLayer({ viewer, comments }: { viewer: DiagramHost | null; comments: Record<string, string> }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    const overlays = viewer.get("overlays");
    const registry = viewer.get("elementRegistry");
    const roots: Root[] = [];
    let hideTimer = 0;
    let open = false;

    function anchorOf(element: DiagramElement): TooltipRect | null {
      const gfx = registry.getGraphics(element);
      if (!gfx) {
        return null;
      }
      const box = gfx.getBoundingClientRect();
      return { top: box.top, left: box.left, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    }

    function showFor(element: DiagramElement) {
      const target = element.labelTarget ?? element;
      const text = visibleComment(comments[target.id]);
      const anchor = text ? anchorOf(target) : null;
      if (!text || !anchor) {
        scheduleHide();
        return;
      }
      window.clearTimeout(hideTimer);
      open = true;
      setTooltip({ text, anchor });
    }

    function scheduleHide() {
      open = false;
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!open) {
          setTooltip(null);
        }
      }, 120);
    }

    function onHover(event: { element?: DiagramElement }) {
      if (event.element) {
        showFor(event.element);
      }
    }

    function clearOverlays() {
      for (const overlay of overlays.get({ type: "comment" })) {
        overlays.remove(overlay.id);
      }
      for (const root of roots) {
        root.unmount();
      }
      roots.length = 0;
    }

    function sync() {
      clearOverlays();

      for (const [id, raw] of Object.entries(comments)) {
        if (!visibleComment(raw)) {
          continue;
        }
        const element = registry.get(id);
        if (!element || element.waypoints || element.type === "label" || element.labelTarget) {
          continue;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "bpmn-comment-indicator";
        button.setAttribute("aria-label", "Comentário");
        const mount = document.createElement("span");
        mount.setAttribute("aria-hidden", "true");
        button.append(mount);
        const root = createRoot(mount);
        root.render(<MessageSquareText size={13} strokeWidth={2} />);
        roots.push(root);

        button.addEventListener("mouseenter", () => showFor(element));
        button.addEventListener("mouseleave", scheduleHide);
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        overlays.add(id, "comment", {
          position: { top: -6, right: -20 },
          html: button,
        });
      }
    }

    sync();
    viewer.on("import.done", sync);
    viewer.on("element.hover", onHover);
    viewer.on("element.out", scheduleHide);
    viewer.on("canvas.viewbox.changing", scheduleHide);

    return () => {
      window.clearTimeout(hideTimer);
      viewer.off("import.done", sync);
      viewer.off("element.hover", onHover);
      viewer.off("element.out", scheduleHide);
      viewer.off("canvas.viewbox.changing", scheduleHide);
      clearOverlays();
      setTooltip(null);
    };
  }, [viewer, comments]);

  if (!tooltip) {
    return null;
  }

  return createPortal(<CommentTooltip text={tooltip.text} anchor={tooltip.anchor} />, document.body);
}

function CommentTooltip({ text, anchor }: { text: string; anchor: TooltipRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ top: -9999, left: 0, ready: false });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const box = node.getBoundingClientRect();
    const next = placeCommentTooltip(anchor, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight });
    setPlace({ top: next.top, left: next.left, ready: true });
  }, [anchor, text]);

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ position: "fixed", top: place.top, left: place.left, visibility: place.ready ? "visible" : "hidden", maxWidth: 300, zIndex: 70, pointerEvents: "none" }}
      className="border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-lg"
    >
      <p className="text-xs font-semibold text-zinc-500">Comentário</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{text}</p>
    </div>
  );
}
