import { formatError, onLanguageChange, t } from '../../i18n';
import { formatQuantity, parseNumber } from '../../lib/number';
import { CATEGORIES, convertAll, unitsIn, type Category, type UnitId } from '../../lib/units';
import { el, field, messageBox, setOptions, showMessage } from '../dom';
import { downloadText, wireCopy } from '../download';

export function mountUnits(root: HTMLElement): () => void {
  const category = el('select');
  const value = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: '1' });
  const unit = el('select');
  const error = messageBox();
  const note = el('p', { class: 'note', 'data-i18n': 'units.dataNote' }, [t('units.dataNote')]);
  const tableBody = el('tbody');
  const copyButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.copy' }, [
    t('action.copy'),
  ]);
  const downloadButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.download' }, [
    t('action.download'),
  ]);
  let summary = '';

  root.append(
    el('h1', { class: 'panel-title', 'data-i18n': 'tab.units' }, [t('tab.units')]),
    el('p', { class: 'lead', 'data-i18n': 'units.lead' }, [t('units.lead')]),
    el('div', { class: 'controls' }, [
      field('units-category', 'units.category', category),
      field('units-value', 'units.value', value),
      field('units-unit', 'units.unit', unit),
    ]),
    note,
    error,
    el('h2', { 'data-i18n': 'units.results' }, [t('units.results')]),
    el('table', { class: 'units' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { scope: 'col', 'data-i18n': 'units.resultUnit' }, [t('units.resultUnit')]),
          el('th', { scope: 'col', 'data-i18n': 'units.resultValue' }, [t('units.resultValue')]),
          el('th', { scope: 'col' }, [el('span', { class: 'sr', 'data-i18n': 'action.copy' }, [t('action.copy')])]),
        ]),
      ]),
      tableBody,
    ]),
    el('div', { class: 'actions' }, [copyButton, downloadButton]),
  );

  const fillCategories = () => {
    setOptions(
      category,
      CATEGORIES.map((id) => ({ value: id, labelKey: `units.cat.${id}` })),
    );
  };

  const currentCategory = (): Category =>
    (CATEGORIES as readonly string[]).includes(category.value) ? (category.value as Category) : 'length';

  const fillUnits = () => {
    const selected = currentCategory();
    setOptions(
      unit,
      unitsIn(selected).map((id) => ({ value: id, labelKey: `units.${id}` })),
    );
    note.hidden = selected !== 'data';
  };

  const lineFor = (amount: string, id: UnitId) => `${amount} ${t(`units.symbol.${id}`)}`;

  const render = () => {
    const parsed = parseNumber(value.value);
    tableBody.replaceChildren();
    if (!parsed.ok) {
      summary = '';
      showMessage(error, formatError(parsed.error));
      return;
    }
    const rows = convertAll(parsed.value, unit.value);
    if (!rows.ok) {
      summary = '';
      showMessage(error, formatError(rows.error));
      return;
    }
    showMessage(error, '');
    const lines: string[] = [];
    for (const row of rows.value) {
      const amount = formatQuantity(row.value);
      const symbol = t(`units.symbol.${row.unit}`);
      const label = t(`units.${row.unit}`);
      const line = `${amount} ${symbol}`;
      lines.push(`${line} — ${label}`);
      const copy = el('button', { type: 'button', class: 'button button-secondary' }, [t('action.copy')]);
      copy.setAttribute('aria-label', `${t('action.copy')} ${label}`);
      wireCopy(copy, () => line);
      tableBody.append(
        el('tr', {}, [el('th', { scope: 'row' }, [label]), el('td', {}, [lineFor(amount, row.unit)]), el('td', {}, [copy])]),
      );
    }
    summary = lines.join('\n');
  };

  fillCategories();
  category.value = 'length';
  fillUnits();
  unit.value = 'm';
  render();

  category.addEventListener('change', () => {
    fillUnits();
    render();
  });
  unit.addEventListener('change', render);
  value.addEventListener('input', render);
  wireCopy(copyButton, () => {
    if (!summary) {
      showMessage(error, formatError({ code: 'empty_value' }));
      return null;
    }
    return summary;
  });
  downloadButton.addEventListener('click', () => {
    if (!summary) {
      showMessage(error, formatError({ code: 'empty_value' }));
      return;
    }
    downloadText(summary, t('units.outputName'));
  });

  return onLanguageChange(() => {
    fillCategories();
    fillUnits();
    render();
  });
}
