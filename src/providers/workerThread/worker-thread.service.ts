import { Worker } from 'worker_threads';
import path from 'path';
import { config } from '../../config/configuration';
import { logger } from '../../logger/logger';

export type WorkerTaskName = 'simplifyDebts' | 'exportCsv';

interface WorkerReply {
  result?: unknown;
  error?: string;
}

interface PendingTask {
  data: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

interface PoolWorker {
  worker: Worker;
  current: PendingTask | null;
}

// When running from TypeScript sources (ts-node-dev) the worker file is a .ts file.
const IS_TS_RUNTIME = path.extname(__filename) === '.ts';

/**
 * A small pool of long-lived threads for one task. Tasks queue up when every
 * thread is busy; a crashed thread is replaced on demand.
 */
class TaskPool {
  private readonly workers: PoolWorker[] = [];
  private readonly queue: PendingTask[] = [];
  private closed = false;

  constructor(
    private readonly name: WorkerTaskName,
    private readonly size: number,
  ) {}

  run<TInput, TOutput>(data: TInput): Promise<TOutput> {
    if (this.closed) return Promise.reject(new Error('Worker pool is closed'));
    return new Promise<TOutput>((resolve, reject) => {
      this.queue.push({ data, resolve: resolve as (value: unknown) => void, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const free = this.workers.find((w) => w.current === null) ?? this.spawnIfRoom();
      if (!free) return;
      const task = this.queue.shift();
      if (!task) return;
      free.current = task;
      free.worker.postMessage({ data: task.data });
    }
  }

  private spawnIfRoom(): PoolWorker | undefined {
    if (this.workers.length >= this.size) return undefined;

    const file = path.join(__dirname, `${this.name}.worker${IS_TS_RUNTIME ? '.ts' : '.js'}`);
    const worker = new Worker(file, {
      execArgv: IS_TS_RUNTIME ? ['-r', 'ts-node/register/transpile-only'] : [],
    });
    worker.unref();
    const pw: PoolWorker = { worker, current: null };

    worker.on('message', (reply: WorkerReply) => {
      const task = pw.current;
      pw.current = null;
      if (task) {
        if (reply.error) task.reject(new Error(reply.error));
        else task.resolve(reply.result);
      }
      this.drain();
    });

    const retire = (err: Error): void => {
      const index = this.workers.indexOf(pw);
      if (index >= 0) this.workers.splice(index, 1);
      const task = pw.current;
      pw.current = null;
      if (task) task.reject(err);
      if (!this.closed) this.drain();
    };
    worker.on('error', (err) => {
      logger.error('Worker thread error', { worker: this.name, err });
      retire(err);
    });
    worker.on('exit', (code) => retire(new Error(`Worker ${this.name} exited with code ${code}`)));

    this.workers.push(pw);
    return pw;
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    for (const task of this.queue.splice(0)) task.reject(new Error('Worker pool is closed'));
    await Promise.all(this.workers.map((w) => w.worker.terminate()));
  }
}

export class WorkerThreadService {
  private readonly pools = new Map<WorkerTaskName, TaskPool>();

  /** Runs `name` on a pooled worker thread. Input and output are plain data. */
  runTask<TInput, TOutput>(name: WorkerTaskName, data: TInput): Promise<TOutput> {
    let pool = this.pools.get(name);
    if (!pool) {
      pool = new TaskPool(name, config.WORKER_POOL_SIZE);
      this.pools.set(name, pool);
    }
    return pool.run<TInput, TOutput>(data);
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.pools.values()].map((p) => p.shutdown()));
    this.pools.clear();
  }
}

export const workerThreadService = new WorkerThreadService();
