import type { WorkerRequest, WorkerResponse } from '../lib/imageProtocol';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, (response: WorkerResponse) => void>();

export function runJob(request: WithoutId<WorkerRequest>): Promise<WorkerResponse> {
  const id = ++sequence;
  const current = ensureWorker();
  const message = { ...request, id } as WorkerRequest;
  const transfer: Transferable[] = [];
  if ('buffer' in message && message.buffer instanceof ArrayBuffer) transfer.push(message.buffer);
  return new Promise((resolve) => {
    pending.set(id, resolve);
    current.postMessage(message, transfer);
  });
}

export function stopJobs(): void {
  worker?.terminate();
  worker = null;
  for (const [id, resolve] of pending) {
    resolve({ id, ok: false, error: { code: 'worker_failed' } });
  }
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/convert.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const resolve = pending.get(response.id);
    if (!resolve) return;
    pending.delete(response.id);
    resolve(response);
  };
  worker.onerror = () => {
    stopJobs();
  };
  return worker;
}
