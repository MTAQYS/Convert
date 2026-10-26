import { formatError, onLanguageChange, t } from '../../i18n';
import type { ConvertError } from '../../lib/errors';
import {
  IMAGE_FORMATS,
  checkFileSize,
  detectFormat,
  normalizeQuality,
  outputName,
  parsePixel,
  uniqueFilenames,
  type ImageFormat,
} from '../../lib/image';
import { formatByteSize } from '../../lib/units';
import { buildZip } from '../../lib/zip';
import { announce } from '../announce';
import { detectAvifEncode } from '../avif';
import { bindDrop, el, field, messageBox, setOptions, showMessage } from '../dom';
import { downloadBlob } from '../download';
import { runJob, stopJobs } from '../jobs';

type Item = {
  key: number;
  file: File;
  status: 'queued' | 'working' | 'done' | 'error';
  error?: ConvertError;
  blob?: Blob;
  outName?: string;
};

const FILE_ERRORS = new Set(['image_type_unsupported', 'file_too_large', 'empty_input']);

export function mountImages(root: HTMLElement): () => void {
  const items: Item[] = [];
  let nextKey = 1;
  let runId = 0;
  let avifSupported: boolean | null = null;

  const drop = el('div', { class: 'drop' });
  drop.append(
    el('p', { class: 'drop-title', 'data-i18n': 'images.drop' }, [t('images.drop')]),
    el('p', { class: 'hint', id: 'images-drop-hint', 'data-i18n': 'images.dropHint' }, [t('images.dropHint')]),
  );
  const fileInput = el('input', {
    class: 'file-input',
    id: 'images-file',
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif',
    'aria-describedby': 'images-drop-hint',
  });
  fileInput.multiple = true;
  const browse = el('label', { class: 'button', for: 'images-file', 'data-i18n': 'action.browse' }, [t('action.browse')]);
  drop.append(fileInput, browse);

  const format = el('select');
  const quality = el('input', { type: 'range', min: '1', max: '100', value: '85', id: 'images-quality' });
  const qualityReadout = el('span', { class: 'quality-value', id: 'images-quality-value' }, ['85']);
  const qualityField = el('div', { class: 'field' }, [
    el('div', { class: 'label-row' }, [
      el('label', { for: 'images-quality', 'data-i18n': 'images.quality' }, [t('images.quality')]),
      qualityReadout,
    ]),
    quality,
  ]);
  const qualityNote = el('p', { class: 'hint', id: 'images-quality-note', 'data-i18n': 'images.qualityPng' }, [
    t('images.qualityPng'),
  ]);
  qualityNote.hidden = true;
  const width = el('input', {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    'data-i18n-attr': 'placeholder:images.widthPlaceholder',
  });
  width.placeholder = t('images.widthPlaceholder');
  const height = el('input', {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    'data-i18n-attr': 'placeholder:images.heightPlaceholder',
  });
  height.placeholder = t('images.heightPlaceholder');
  const keep = el('input', { type: 'checkbox' });
  keep.checked = true;
  const keepLabel = el('label', { class: 'check' }, [
    keep,
    el('span', { 'data-i18n': 'images.keepRatio' }, [t('images.keepRatio')]),
  ]);
  const avifNote = el('p', { class: 'note', 'data-i18n': 'images.avifUnsupported' }, [t('images.avifUnsupported')]);
  avifNote.hidden = true;
  const jpegNote = el('p', { class: 'hint', 'data-i18n': 'images.jpegHint' }, [t('images.jpegHint')]);
  jpegNote.hidden = true;
  const formError = messageBox();
  const convertButton = el('button', { type: 'button', class: 'button', 'data-i18n': 'action.convert' }, [t('action.convert')]);
  const cancelButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.cancel' }, [
    t('action.cancel'),
  ]);
  cancelButton.hidden = true;

  const list = el('ul', { class: 'results' });
  const empty = el('p', { class: 'hint', 'data-i18n': 'images.empty' }, [t('images.empty')]);
  const progress = el('p', { class: 'hint' });
  progress.hidden = true;
  const zipButton = el('button', { type: 'button', class: 'button', 'data-i18n': 'action.downloadZip' }, [
    t('action.downloadZip'),
  ]);
  zipButton.hidden = true;

  const options = el('div', { class: 'stack' }, [
    field('images-format', 'images.format', format),
    avifNote,
    qualityField,
    qualityNote,
    el('div', { class: 'split' }, [
      field('images-width', 'images.width', width, 'images.resizeHint'),
      field('images-height', 'images.height', height),
    ]),
    keepLabel,
    jpegNote,
    formError,
    el('div', { class: 'actions' }, [convertButton, cancelButton]),
  ]);
  const results = el('div', { class: 'stack' }, [
    el('h2', { 'data-i18n': 'images.results' }, [t('images.results')]),
    progress,
    empty,
    list,
    zipButton,
  ]);

  root.append(
    el('h1', { class: 'panel-title', 'data-i18n': 'tab.images' }, [t('tab.images')]),
    el('p', { class: 'lead', 'data-i18n': 'images.lead' }, [t('images.lead')]),
    drop,
    el('div', { class: 'panes' }, [options, results]),
  );

  const fillFormats = () => setOptions(format, IMAGE_FORMATS.map((value) => ({ value, labelKey: `format.${value}` })));
  fillFormats();

  const targetFormat = (): ImageFormat =>
    (IMAGE_FORMATS as readonly string[]).includes(format.value) ? (format.value as ImageFormat) : 'png';

  const refreshNotes = () => {
    const target = targetFormat();
    quality.disabled = target === 'png';
    qualityNote.hidden = target !== 'png';
    jpegNote.hidden = target !== 'jpeg';
    avifNote.hidden = !(target === 'avif' && avifSupported === false);
    quality.setAttribute('aria-valuetext', quality.value);
    qualityReadout.textContent = quality.value;
  };

  const render = () => {
    list.replaceChildren();
    empty.hidden = items.length > 0;
    const done = items.filter((item) => item.status === 'done').length;
    const active = items.some((item) => item.status === 'working');
    progress.hidden = !active;
    progress.textContent = active ? t('images.progress', { done, total: items.length }) : '';
    zipButton.hidden = done < 2;
    for (const item of items) list.append(renderItem(item));
  };

  const renderItem = (item: Item) => {
    const detail = el('p', { class: item.status === 'error' ? 'message inline' : 'hint' });
    if (item.status === 'error' && item.error) detail.textContent = formatError(item.error);
    else if (item.status === 'done' && item.blob && item.outName) {
      const size = formatByteSize(item.blob.size);
      detail.textContent = `${t('images.done')} · ${item.outName} · ${size.amount} ${t(`units.symbol.${size.unit}`)}`;
    } else detail.textContent = t(`images.${item.status}`);
    const actions = el('div', { class: 'row-actions' });
    if (item.blob && item.outName) {
      const copy = el('button', { type: 'button', class: 'button button-secondary' }, [t('action.copy')]);
      copy.setAttribute('aria-label', `${t('action.copy')} ${item.outName}`);
      copy.addEventListener('click', () => void copyItem(item, copy));
      const save = el('button', { type: 'button', class: 'button button-secondary' }, [t('action.download')]);
      save.setAttribute('aria-label', `${t('action.download')} ${item.outName}`);
      save.addEventListener('click', () => {
        if (item.blob && item.outName) downloadBlob(item.blob, item.outName);
      });
      actions.append(copy, save);
    }
    const remove = el('button', { type: 'button', class: 'button button-secondary' }, [t('images.remove')]);
    remove.setAttribute('aria-label', `${t('images.remove')} ${item.file.name}`);
    remove.addEventListener('click', () => {
      const index = items.findIndex((candidate) => candidate.key === item.key);
      if (index >= 0) items.splice(index, 1);
      render();
    });
    actions.append(remove);
    return el('li', { class: 'result' }, [el('div', {}, [el('p', { class: 'file-name' }, [item.file.name]), detail]), actions]);
  };

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const size = checkFileSize(file.size);
      const kind = size.ok ? detectFormat(file.name, file.type) : size;
      items.push({
        key: nextKey,
        file,
        status: kind.ok ? 'queued' : 'error',
        error: kind.ok ? undefined : kind.error,
      });
      nextKey += 1;
    }
    showMessage(formError, '');
    render();
  };

  const finishRun = (run: number) => {
    if (run !== runId) return;
    convertButton.disabled = false;
    cancelButton.hidden = true;
    render();
  };

  const convertAll = async () => {
    const target = targetFormat();
    const widthValue = parsePixel(width.value);
    const heightValue = parsePixel(height.value);
    const qualityValue = normalizeQuality(target, Number(quality.value));
    if (!widthValue.ok) return showMessage(formError, formatError(widthValue.error));
    if (!heightValue.ok) return showMessage(formError, formatError(heightValue.error));
    if (!qualityValue.ok) return showMessage(formError, formatError(qualityValue.error));
    if (target === 'avif' && avifSupported !== true) {
      return showMessage(formError, formatError({ code: 'avif_encode_unsupported' }));
    }
    showMessage(formError, '');
    const queue = items.filter((item) => !(item.error && FILE_ERRORS.has(item.error.code)));
    if (queue.length === 0) {
      if (items.length === 0) showMessage(formError, formatError({ code: 'empty_input' }));
      return;
    }
    const names = uniqueFilenames(queue.map((item) => outputName(item.file.name, target)));
    queue.forEach((item, index) => {
      item.outName = names[index];
    });
    const run = ++runId;
    convertButton.disabled = true;
    cancelButton.hidden = false;
    for (const item of queue) {
      if (run !== runId) return;
      item.status = 'working';
      item.error = undefined;
      render();
      const result = await runJob({
        kind: 'convert',
        file: item.file,
        target,
        quality: qualityValue.value,
        width: widthValue.value,
        height: heightValue.value,
        keepRatio: keep.checked,
      });
      if (run !== runId) return;
      if (result.ok && 'buffer' in result) {
        item.status = 'done';
        item.blob = new Blob([result.buffer], { type: result.mime });
        item.error = undefined;
      } else {
        item.status = 'error';
        item.blob = undefined;
        item.outName = undefined;
        item.error = result.ok ? { code: 'image_encode_failed' } : result.error;
      }
      render();
    }
    announce(t('images.progress', { done: items.filter((item) => item.status === 'done').length, total: items.length }));
    finishRun(run);
  };

  fileInput.addEventListener('change', () => {
    addFiles([...(fileInput.files ?? [])]);
    fileInput.value = '';
  });
  bindDrop(drop, addFiles);
  format.addEventListener('change', refreshNotes);
  quality.addEventListener('input', refreshNotes);
  convertButton.addEventListener('click', () => void convertAll());
  cancelButton.addEventListener('click', () => {
    runId += 1;
    stopJobs();
    for (const item of items) {
      if (item.status === 'working') item.status = 'queued';
    }
    convertButton.disabled = false;
    cancelButton.hidden = true;
    render();
  });
  zipButton.addEventListener('click', () => {
    void (async () => {
      const files: { name: string; data: Uint8Array }[] = [];
      for (const item of items) {
        if (!item.blob || !item.outName) continue;
        files.push({ name: item.outName, data: new Uint8Array(await item.blob.arrayBuffer()) });
      }
      const zip = buildZip(files);
      if (!zip.ok) {
        showMessage(formError, formatError(zip.error));
        return;
      }
      const zipped = zip.value;
      const buffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([buffer], { type: 'application/zip' }), t('images.zipName'));
    })();
  });

  const stopLang = onLanguageChange(() => {
    fillFormats();
    refreshNotes();
    render();
  });

  refreshNotes();
  render();
  void detectAvifEncode().then((supported) => {
    avifSupported = supported;
    refreshNotes();
  });

  return () => {
    runId += 1;
    stopLang();
  };
}

async function copyItem(item: Item, button: HTMLButtonElement): Promise<void> {
  if (!item.blob) return;
  try {
    let png = item.blob;
    if (png.type !== 'image/png') {
      const buffer = await png.arrayBuffer();
      const result = await runJob({ kind: 'png', buffer, mime: png.type || 'application/octet-stream' });
      if (!result.ok || !('buffer' in result)) {
        announce(t('action.copyFailed'));
        return;
      }
      png = new Blob([result.buffer], { type: 'image/png' });
    }
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      announce(t('action.copyFailed'));
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    button.textContent = t('action.copied');
    announce(t(item.blob.type === 'image/png' ? 'images.copied' : 'images.copiedPng'));
    window.setTimeout(() => {
      button.textContent = t('action.copy');
    }, 1600);
  } catch {
    announce(t('action.copyFailed'));
  }
}
