import { describe, expect, it, vi } from "vitest";
import { SaveQueue } from "@/features/bpmn/utils/save-queue";

describe("autosave", () => {
  it("agrupa alterações próximas em um único salvamento", async () => {
    vi.useFakeTimers();
    const runs: string[] = [];
    const queue = new SaveQueue(1500, () => undefined);

    queue.schedule(async () => {
      runs.push("primeiro");
    });
    queue.schedule(async () => {
      runs.push("último");
    });

    await vi.advanceTimersByTimeAsync(1499);
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual(["último"]);
    queue.cancel();
    vi.useRealTimers();
  });

  it("não dispara salvamentos simultâneos", async () => {
    vi.useFakeTimers();
    let active = 0;
    let maxActive = 0;
    const queue = new SaveQueue(1500, () => undefined);
    const task = () =>
      new Promise<void>((resolve) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        setTimeout(() => {
          active -= 1;
          resolve();
        }, 400);
      });

    queue.schedule(task);
    await vi.advanceTimersByTimeAsync(1500);
    queue.schedule(task);
    await vi.advanceTimersByTimeAsync(100);
    expect(maxActive).toBe(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(maxActive).toBe(1);
    expect(active).toBe(0);
    queue.cancel();
    vi.useRealTimers();
  });

  it("salva imediatamente quando o usuário solicita", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const queue = new SaveQueue(1500, () => undefined);
    queue.flushNow(async () => {
      runs += 1;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(runs).toBe(1);
    queue.cancel();
    vi.useRealTimers();
  });
});
