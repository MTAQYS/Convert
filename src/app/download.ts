import { announce } from './announce';
import { t } from '../i18n';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function wireCopy(button: HTMLButtonElement, getText: () => string | null): void {
  button.addEventListener('click', () => {
    const text = getText();
    if (text === null) return;
    void copyText(text).then((success) => {
      if (!success) {
        announce(t('action.copyFailed'));
        return;
      }
      button.textContent = t('action.copied');
      announce(t('action.copied'));
      window.setTimeout(() => {
        button.textContent = t('action.copy');
      }, 1600);
    });
  });
}
