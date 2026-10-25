import { formatError, onLanguageChange, t } from '../../i18n';
import {
  decodeBase64Text,
  decodeHtml,
  decodeUrl,
  encodeBase64Text,
  encodeHtml,
  encodeUrl,
} from '../../lib/encoding';
import type { ConvertResult } from '../../lib/errors';
import { checkFileSize } from '../../lib/image';
import { announce } from '../announce';
import { bindDrop, el, field, messageBox, onShortcut, setOptions, showMessage } from '../dom';
import { downloadBlob, downloadText, wireCopy } from '../download';
import { runJob } from '../jobs';

type Kind = 'base64' | 'url' | 'html';
type Direction = 'encode' | 'decode';
type InputMode = 'text' | 'file';

export function mountEncoding(root: HTMLElement): () => void {
  const kind = el('select');
  const direction = el('select');
  const mode = el('select');
  const source = el('textarea', { spellcheck: 'false', 'data-i18n-attr': 'placeholder:encoding.placeholder' });
  source.placeholder = t('encoding.placeholder');
  source.rows = 12;
  const output = el('textarea', { readonly: 'true', spellcheck: 'false' });
  output.rows = 12;
  const fileName = el('input', {
    type: 'text',
    autocomplete: 'off',
    'data-i18n-attr': 'placeholder:encoding.defaultFileName',
  });
  fileName.placeholder = t('encoding.defaultFileName');
  const error = messageBox();
  const status = el('p', { class: 'hint', role: 'status' });
  const convertButton = el('button', { type: 'button', class: 'button', 'data-i18n': 'action.convert' }, [t('action.convert')]);
  const copyButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.copy' }, [
    t('action.copy'),
  ]);
  const downloadButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.download' }, [
    t('action.download'),
  ]);
  const fileButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.download' }, [
    t('action.download'),
  ]);
  const urlHint = el('p', { class: 'hint', 'data-i18n': 'encoding.urlHint' }, [t('encoding.urlHint')]);
  const htmlHint = el('p', { class: 'hint', 'data-i18n': 'encoding.htmlHint' }, [t('encoding.htmlHint')]);
  const drop = el('div', { class: 'drop' });
  const fileInput = el('input', {
    class: 'file-input',
    id: 'encoding-file',
    type: 'file',
    'aria-describedby': 'encoding-drop-hint',
  });
  drop.append(
    el('p', { class: 'drop-title', 'data-i18n': 'encoding.fileDrop' }, [t('encoding.fileDrop')]),
    el('p', { class: 'hint', id: 'encoding-drop-hint', 'data-i18n': 'images.dropHint' }, [t('images.dropHint')]),
    fileInput,
    el('label', { class: 'button', for: 'encoding-file', 'data-i18n': 'action.browse' }, [t('action.browse')]),
  );

  const modeField = field('encoding-mode', 'encoding.inputMode', mode);
  const fileNameField = field('encoding-filename', 'encoding.fileName', fileName, 'encoding.fileNameHint');
  const sourceField = field('encoding-source', 'encoding.source', source);
  const outputField = field('encoding-output', 'encoding.output', output);
  let selected: File | null = null;
  let decoded: { name: string; blob: Blob } | null = null;
  let textResult = '';
  let textReady = false;

  root.append(
    el('h1', { class: 'panel-title', 'data-i18n': 'tab.encoding' }, [t('tab.encoding')]),
    el('p', { class: 'lead', 'data-i18n': 'encoding.lead' }, [t('encoding.lead')]),
    el('div', { class: 'controls' }, [
      field('encoding-kind', 'encoding.kind', kind),
      field('encoding-direction', 'encoding.direction', direction),
      modeField,
      convertButton,
    ]),
    urlHint,
    htmlHint,
    error,
    status,
    el('div', { class: 'panes' }, [
      el('div', { class: 'stack' }, [sourceField, drop, fileNameField, el('p', { class: 'hint', 'data-i18n': 'hint.shortcut' }, [t('hint.shortcut')])]),
      el('div', { class: 'stack' }, [outputField, el('div', { class: 'actions' }, [copyButton, downloadButton, fileButton])]),
    ]),
  );

  const fill = () => {
    setOptions(kind, [
      { value: 'base64', labelKey: 'encoding.base64' },
      { value: 'url', labelKey: 'encoding.url' },
      { value: 'html', labelKey: 'encoding.html' },
    ]);
    setOptions(direction, [
      { value: 'encode', labelKey: 'encoding.encode' },
      { value: 'decode', labelKey: 'encoding.decode' },
    ]);
    setOptions(mode, [
      { value: 'text', labelKey: 'encoding.text' },
      { value: 'file', labelKey: 'encoding.file' },
    ]);
  };
  fill();

  const currentKind = (): Kind => (kind.value === 'url' || kind.value === 'html' ? kind.value : 'base64');
  const currentDirection = (): Direction => (direction.value === 'decode' ? 'decode' : 'encode');
  const currentMode = (): InputMode => (mode.value === 'file' ? 'file' : 'text');

  const sync = () => {
    const fileEncode = currentKind() === 'base64' && currentMode() === 'file' && currentDirection() === 'encode';
    const fileDecode = currentKind() === 'base64' && currentMode() === 'file' && currentDirection() === 'decode';
    modeField.hidden = currentKind() !== 'base64';
    drop.hidden = !fileEncode;
    sourceField.hidden = fileEncode;
    fileNameField.hidden = !fileDecode;
    outputField.hidden = fileDecode;
    copyButton.hidden = fileDecode;
    downloadButton.hidden = fileDecode;
    fileButton.hidden = !fileDecode;
    urlHint.hidden = currentKind() !== 'url';
    htmlHint.hidden = currentKind() !== 'html';
  };

  const showText = (value: ConvertResult<string>) => {
    if (!value.ok) {
      textResult = '';
      textReady = false;
      output.value = '';
      showMessage(error, formatError(value.error));
      announce(formatError(value.error));
      return;
    }
    textResult = value.value;
    textReady = true;
    output.value = value.value;
    showMessage(error, '');
    status.textContent = t('action.done');
  };

  const convertText = () => {
    const text = source.value;
    const way = currentDirection();
    if (currentKind() === 'url') return showText(way === 'encode' ? encodeUrl(text) : decodeUrl(text));
    if (currentKind() === 'html') return showText(way === 'encode' ? encodeHtml(text) : decodeHtml(text));
    return showText(way === 'encode' ? encodeBase64Text(text) : decodeBase64Text(text));
  };

  const convertFile = async () => {
    if (currentDirection() === 'encode') {
      if (!selected) {
        showMessage(error, formatError({ code: 'empty_input' }));
        return;
      }
      const size = checkFileSize(selected.size);
      if (!size.ok) {
        showMessage(error, formatError(size.error));
        return;
      }
      status.textContent = t('action.working');
      const buffer = await selected.arrayBuffer();
      const result = await runJob({ kind: 'base64-encode', buffer });
      status.textContent = '';
      if (!result.ok || !('text' in result)) {
        showMessage(error, formatError(result.ok ? { code: 'base64_invalid' } : result.error));
        return;
      }
      textResult = result.text;
      textReady = true;
      output.value = result.text;
      showMessage(error, '');
      status.textContent = t('action.done');
      return;
    }
    status.textContent = t('action.working');
    const result = await runJob({ kind: 'base64-decode', text: source.value });
    status.textContent = '';
    if (!result.ok || !('buffer' in result)) {
      decoded = null;
      showMessage(error, formatError(result.ok ? { code: 'base64_invalid' } : result.error));
      return;
    }
    const name = fileName.value.trim() || t('encoding.defaultFileName');
    decoded = { name, blob: new Blob([result.buffer], { type: 'application/octet-stream' }) };
    showMessage(error, '');
    status.textContent = t('encoding.fileReady', { name });
  };

  const run = () => {
    if (currentKind() === 'base64' && currentMode() === 'file') void convertFile();
    else convertText();
  };

  kind.addEventListener('change', sync);
  direction.addEventListener('change', sync);
  mode.addEventListener('change', sync);
  convertButton.addEventListener('click', run);
  onShortcut(source, run);
  wireCopy(copyButton, () => {
    if (!textReady) {
      showMessage(error, formatError({ code: 'empty_input' }));
      return null;
    }
    return textResult;
  });
  downloadButton.addEventListener('click', () => downloadText(output.value, 'convert.txt'));
  fileButton.addEventListener('click', () => {
    if (!decoded) {
      showMessage(error, formatError({ code: 'empty_input' }));
      return;
    }
    downloadBlob(decoded.blob, fileName.value.trim() || decoded.name);
  });
  fileInput.addEventListener('change', () => {
    selected = fileInput.files?.[0] ?? null;
    fileInput.value = '';
    if (selected) status.textContent = selected.name;
  });
  bindDrop(drop, (files) => {
    selected = files[0] ?? null;
    if (selected) status.textContent = selected.name;
  });

  sync();
  return onLanguageChange(() => {
    fill();
    sync();
  });
}
