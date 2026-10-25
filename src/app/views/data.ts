import { formatError, onLanguageChange, t } from '../../i18n';
import { convertData, DATA_FORMATS, type DataFormat } from '../../lib/data/convert';
import { checkFileSize } from '../../lib/image';
import { looksBinary } from '../../lib/text';
import { announce } from '../announce';
import { bindDrop, el, field, messageBox, onShortcut, setOptions, showMessage } from '../dom';
import { downloadText, wireCopy } from '../download';

export function mountData(root: HTMLElement): () => void {
  const source = el('textarea', { spellcheck: 'false', 'data-i18n-attr': 'placeholder:data.placeholder' });
  source.placeholder = t('data.placeholder');
  source.rows = 14;
  const output = el('textarea', { readonly: 'true', spellcheck: 'false' });
  output.rows = 14;
  const from = el('select');
  const to = el('select');
  const pretty = el('input', { type: 'checkbox' });
  pretty.checked = true;
  const error = messageBox();
  const convertButton = el('button', { type: 'button', class: 'button', 'data-i18n': 'action.convert' }, [t('action.convert')]);
  const copyButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.copy' }, [
    t('action.copy'),
  ]);
  const downloadButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.download' }, [
    t('action.download'),
  ]);
  const clearButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.clear' }, [
    t('action.clear'),
  ]);
  let result = '';

  const prettyLabel = el('label', { class: 'check' }, [
    pretty,
    el('span', { 'data-i18n': 'data.pretty' }, [t('data.pretty')]),
  ]);

  const controls = el('div', { class: 'controls' }, [
    field('data-from', 'data.from', from),
    field('data-to', 'data.to', to),
    prettyLabel,
    convertButton,
  ]);

  root.append(
    el('h1', { class: 'panel-title', 'data-i18n': 'tab.data' }, [t('tab.data')]),
    el('p', { class: 'lead', 'data-i18n': 'data.lead' }, [t('data.lead')]),
    controls,
    error,
    el('div', { class: 'panes' }, [
      el('div', { class: 'stack' }, [
        field('data-source', 'data.source', source),
        el('p', { class: 'hint', 'data-i18n': 'data.drop' }, [t('data.drop')]),
        el('p', { class: 'hint', 'data-i18n': 'hint.shortcut' }, [t('hint.shortcut')]),
        el('p', { class: 'hint', 'data-i18n': 'data.csvHint' }, [t('data.csvHint')]),
        el('p', { class: 'hint', 'data-i18n': 'data.xmlHint' }, [t('data.xmlHint')]),
        el('div', { class: 'actions' }, [clearButton]),
      ]),
      el('div', { class: 'stack' }, [
        field('data-output', 'data.output', output),
        el('div', { class: 'actions' }, [copyButton, downloadButton]),
      ]),
    ]),
  );

  const options = () => DATA_FORMATS.map((value) => ({ value, labelKey: `format.${value}` }));
  const fill = () => {
    setOptions(from, options());
    setOptions(to, options());
  };
  fill();
  from.value = 'json';
  to.value = 'yaml';

  const formatOf = (select: HTMLSelectElement): DataFormat =>
    (DATA_FORMATS as readonly string[]).includes(select.value) ? (select.value as DataFormat) : 'json';

  const run = () => {
    const converted = convertData(source.value, formatOf(from), formatOf(to), pretty.checked);
    if (!converted.ok) {
      result = '';
      output.value = '';
      showMessage(error, formatError(converted.error));
      announce(formatError(converted.error));
      return;
    }
    result = converted.value;
    output.value = converted.value;
    showMessage(error, '');
    announce(t('action.done'));
  };

  const readFile = async (file: File) => {
    const size = checkFileSize(file.size);
    if (!size.ok) {
      showMessage(error, formatError(size.error));
      return;
    }
    const text = await file.text();
    if (looksBinary(text)) {
      showMessage(error, formatError({ code: 'not_text' }));
      return;
    }
    source.value = text;
    showMessage(error, '');
  };

  convertButton.addEventListener('click', run);
  onShortcut(source, run);
  clearButton.addEventListener('click', () => {
    source.value = '';
    output.value = '';
    result = '';
    showMessage(error, '');
  });
  wireCopy(copyButton, () => {
    if (!output.value) {
      showMessage(error, formatError({ code: 'empty_input' }));
      return null;
    }
    return output.value;
  });
  downloadButton.addEventListener('click', () => {
    if (!result && output.value === '') {
      showMessage(error, formatError({ code: 'empty_input' }));
      return;
    }
    const extension = formatOf(to) === 'yaml' ? 'yaml' : formatOf(to);
    downloadText(output.value, `convert.${extension}`);
  });
  bindDrop(source.closest('.stack') ?? root, (files) => {
    if (files[0]) void readFile(files[0]);
  });

  const stopLang = onLanguageChange(fill);
  return stopLang;
}
