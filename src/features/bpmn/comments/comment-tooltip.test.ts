import { describe, expect, it } from "vitest";
import { placeCommentTooltip, visibleComment } from "@/features/bpmn/comments/comment-tooltip";

const tooltip = { width: 300, height: 80 };
const viewport = { width: 1200, height: 800 };

describe("comentário do elemento", () => {
  it("esconde comentário vazio e preserva quebras internas", () => {
    expect(visibleComment("  ")).toBeNull();
    expect(visibleComment(undefined)).toBeNull();
    expect(visibleComment("  linha 1\nlinha 2  ")).toBe("linha 1\nlinha 2");
  });

  it("posiciona o tooltip acima do elemento quando há espaço", () => {
    const place = placeCommentTooltip(
      { top: 200, left: 400, right: 500, bottom: 280, width: 100, height: 80 },
      tooltip,
      viewport,
    );

    expect(place.top).toBe(200 - 80 - 8);
    expect(place.left).toBe(400 + 50 - 150);
  });

  it("desce o tooltip quando não cabe acima", () => {
    const place = placeCommentTooltip(
      { top: 20, left: 400, right: 500, bottom: 100, width: 100, height: 80 },
      tooltip,
      viewport,
    );

    expect(place.top).toBe(100 + 8);
  });
});
