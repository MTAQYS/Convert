import { base64ToBytes, bytesToBase64 } from '../lib/encoding';
import { mimeFor, resolveDimensions } from '../lib/image';
import type { WorkerRequest, WorkerResponse } from '../lib/imageProtocol';

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const message = event.data;
  void handle(message)
    .then((response) => {
      if (response.ok && 'buffer' in response) scope.postMessage(response, [response.buffer]);
      else scope.postMessage(response);
    })
    .catch(() => {
      const id = message && typeof message.id === 'number' ? message.id : -1;
      scope.postMessage({ id, ok: false, error: { code: 'worker_failed' } });
    });
};

async function handle(message: WorkerRequest): Promise<WorkerResponse> {
  if (!message || typeof message.id !== 'number') {
    return { id: -1, ok: false, error: { code: 'worker_failed' } };
  }
  if (message.kind === 'base64-encode') return encodeBase64(message.id, message.buffer);
  if (message.kind === 'base64-decode') return decodeBase64(message.id, message.text);
  if (message.kind === 'png') return toPng(message.id, message.buffer, message.mime);
  return convertImage(message);
}

function encodeBase64(id: number, buffer: ArrayBuffer): WorkerResponse {
  const encoded = bytesToBase64(new Uint8Array(buffer));
  return { id, ok: true, text: encoded };
}

function decodeBase64(id: number, text: string): WorkerResponse {
  const bytes = base64ToBytes(text);
  if (!bytes.ok) return { id, ok: false, error: bytes.error };
  const copy = new Uint8Array(bytes.value);
  return { id, ok: true, buffer: copy.buffer as ArrayBuffer, mime: 'application/octet-stream' };
}

async function toPng(id: number, buffer: ArrayBuffer, mime: string): Promise<WorkerResponse> {
  if (mime === 'image/png') return { id, ok: true, buffer, mime };
  return draw(id, new Blob([buffer], { type: mime }), 'png', 1, null, null, true);
}

async function convertImage(message: Extract<WorkerRequest, { kind: 'convert' }>): Promise<WorkerResponse> {
  return draw(
    message.id,
    message.file,
    message.target,
    message.quality,
    message.width,
    message.height,
    message.keepRatio,
  );
}

async function draw(
  id: number,
  source: Blob,
  target: 'png' | 'jpeg' | 'webp' | 'avif',
  quality: number,
  width: number | null,
  height: number | null,
  keepRatio: boolean,
): Promise<WorkerResponse> {
  if (typeof OffscreenCanvas === 'undefined') return { id, ok: false, error: { code: 'worker_failed' } };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return { id, ok: false, error: { code: 'image_decode_failed' } };
  }
  try {
    const size = resolveDimensions(bitmap.width, bitmap.height, width, height, keepRatio);
    if (!size.ok) return { id, ok: false, error: { code: size.error.code } };
    const canvas = new OffscreenCanvas(size.value.width, size.value.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { id, ok: false, error: { code: 'image_encode_failed' } };
    if (target === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.value.width, size.value.height);
    }
    ctx.drawImage(bitmap, 0, 0, size.value.width, size.value.height);
    const mime = mimeFor(target);
    const blob = await canvas.convertToBlob(target === 'png' ? { type: mime } : { type: mime, quality });
    if (target === 'avif' && blob.type !== 'image/avif') {
      return { id, ok: false, error: { code: 'avif_encode_unsupported' } };
    }
    if (blob.type && blob.type !== mime) return { id, ok: false, error: { code: 'image_encode_failed' } };
    return { id, ok: true, buffer: await blob.arrayBuffer(), mime };
  } catch {
    const code = target === 'avif' ? 'avif_encode_unsupported' : 'image_encode_failed';
    return { id, ok: false, error: { code } };
  } finally {
    bitmap.close();
  }
}
