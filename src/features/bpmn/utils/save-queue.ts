export type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveTask = () => Promise<void>;

export class SaveQueue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private queued: SaveTask | null = null;
  private disposed = false;

  constructor(
    private readonly delayMs: number,
    private readonly onStatus: (status: SaveStatus) => void,
  ) {}

  schedule(task: SaveTask): void {
    if (this.disposed) {
      return;
    }

    this.queued = task;
    if (this.inFlight) {
      return;
    }

    this.arm(this.delayMs);
  }

  flushNow(task: SaveTask): void {
    if (this.disposed) {
      return;
    }

    this.queued = task;
    if (this.inFlight) {
      return;
    }

    this.arm(0);
  }

  cancel(): void {
    this.disposed = true;
    this.queued = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private arm(delayMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delayMs);
  }

  private async flush(): Promise<void> {
    const task = this.queued;
    this.queued = null;

    if (!task || this.disposed) {
      return;
    }

    this.inFlight = true;
    this.onStatus("saving");

    try {
      await task();
      if (!this.disposed) {
        this.onStatus(this.queued ? "saving" : "saved");
      }
    } catch {
      if (!this.disposed) {
        this.onStatus("error");
      }
    } finally {
      this.inFlight = false;
      if (!this.disposed && this.queued) {
        this.arm(this.delayMs);
      }
    }
  }
}
