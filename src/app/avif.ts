export async function detectAvifEncode(): Promise<boolean> {
  if (typeof OffscreenCanvas === 'undefined') return false;
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 1, 1);
    const blob = await canvas.convertToBlob({ type: 'image/avif', quality: 0.5 });
    return blob.type === 'image/avif';
  } catch {
    return false;
  }
}
