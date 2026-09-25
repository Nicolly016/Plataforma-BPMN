export interface TooltipRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const GAP = 8;
const MARGIN = 8;

export function visibleComment(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

export function placeCommentTooltip(
  anchor: TooltipRect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const above = anchor.top - tooltip.height - GAP;
  let top = above;
  let left = anchor.left + anchor.width / 2 - tooltip.width / 2;

  if (above < MARGIN) {
    const below = anchor.bottom + GAP;
    if (below + tooltip.height <= viewport.height - MARGIN) {
      top = below;
    } else if (anchor.left - tooltip.width - GAP >= MARGIN) {
      top = clamp(anchor.top, MARGIN, viewport.height - tooltip.height - MARGIN);
      left = anchor.left - tooltip.width - GAP;
    } else {
      top = clamp(anchor.top, MARGIN, viewport.height - tooltip.height - MARGIN);
      left = anchor.right + GAP;
    }
  }

  left = clamp(left, MARGIN, Math.max(MARGIN, viewport.width - tooltip.width - MARGIN));
  top = clamp(top, MARGIN, Math.max(MARGIN, viewport.height - tooltip.height - MARGIN));
  return { top, left };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
