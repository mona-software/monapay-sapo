import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface State {
  processedTransactions: Record<string, { orderId: number; processedAt: string }>;
}

const EMPTY_STATE: State = { processedTransactions: {} };

export class StateStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<State> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as State;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  private async write(state: State): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }

  async hasTransaction(code: string): Promise<boolean> {
    const state = await this.read();
    return Boolean(state.processedTransactions[code]);
  }

  async rememberTransaction(code: string, orderId: number): Promise<void> {
    const operation = this.queue.then(async () => {
      const state = await this.read();
      state.processedTransactions[code] = { orderId, processedAt: new Date().toISOString() };
      await this.write(state);
    });
    this.queue = operation.catch(() => undefined);
    await operation;
  }
}
