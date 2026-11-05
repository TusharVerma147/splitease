import { Worker } from 'worker_threads';
import path from 'path';
import { logger } from '../../logger/logger';

type WorkerName = 'simplifyDebts' | 'exportCsv';

export function runWorker<TInput, TOutput>(
  workerName: WorkerName,
  data: TInput,
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const workerPath = isProduction
      ? path.join(__dirname, `${workerName}.worker.js`)
      : path.join(__dirname, `${workerName}.worker.ts`);

    const workerOptions = isProduction
      ? { workerData: data }
      : {
          workerData: data,
          execArgv: ['-r', 'ts-node/register'],
        };

    const worker = new Worker(workerPath, workerOptions);

    worker.on('message', (result: TOutput) => resolve(result));
    worker.on('error', (err) => {
      logger.error('Worker error', { workerName, err });
      reject(err);
    });
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
