import { formatError, onLanguageChange, t } from '../../i18n';
import {
  BLACK,
  WHITE,
  contrast,
  formatHex,
  formatHsl,
  formatOklch,
  formatRatio,
  formatRgb,
  parseHex,
  parseHsl,
  parseOklch,
  parseRgb,
  type ColorValue,
} from '../../lib/color';
import type { ConvertResult } from '../../lib/errors';
import { el, field, messageBox, showMessage } from '../dom';
import { downloadText, wireCopy } from '../download';

type Channel = 'hex' | 'rgb' | 'hsl' | 'oklch';

const PARSERS: Record<Channel, (input: string) => ConvertResult<ColorValue>> = {
  hex: parseHex,
  rgb: parseRgb,
  hsl: parseHsl,
  oklch: parseOklch,
};

export function mountColors(root: HTMLElement): () => void {
  const inputs: Record<Channel, HTMLInputElement> = {
    hex: el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off' }),
    rgb: el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off' }),
    hsl: el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off' }),
    oklch: el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off' }),
  };
  const swatch = el('div', { class: 'swatch', role: 'img', 'data-i18n-attr': 'aria-label:colors.swatch' });
  swatch.setAttribute('aria-label', t('colors.swatch'));
  const error = messageBox();
  const gamut = el('p', { class: 'note', 'data-i18n': 'colors.outOfGamut' }, [t('colors.outOfGamut')]);
  gamut.hidden = true;
  const blackRatio = el('td', { id: 'contrast-black' });
  const blackScore = el('td', { id: 'score-black' });
  const whiteRatio = el('td', { id: 'contrast-white' });
  const whiteScore = el('td', { id: 'score-white' });
  const copyButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.copy' }, [
    t('action.copy'),
  ]);
  const downloadButton = el('button', { type: 'button', class: 'button button-secondary', 'data-i18n': 'action.download' }, [
    t('action.download'),
  ]);
  let current: ColorValue = { r: 124, g: 45, b: 18, outOfGamut: false };

  const table = el('table', { class: 'contrast' }, [
    el('caption', { 'data-i18n': 'colors.contrast' }, [t('colors.contrast')]),
    el('tbody', {}, [
      el('tr', {}, [el('th', { scope: 'row', 'data-i18n': 'colors.againstBlack' }, [t('colors.againstBlack')]), blackRatio, blackScore]),
      el('tr', {}, [el('th', { scope: 'row', 'data-i18n': 'colors.againstWhite' }, [t('colors.againstWhite')]), whiteRatio, whiteScore]),
    ]),
  ]);

  root.append(
    el('h1', { class: 'panel-title', 'data-i18n': 'tab.colors' }, [t('tab.colors')]),
    el('p', { class: 'lead', 'data-i18n': 'colors.lead' }, [t('colors.lead')]),
    el('div', { class: 'panes colors' }, [
      el('div', { class: 'stack' }, [swatch, gamut]),
      el('div', { class: 'stack' }, [
        field('color-hex', 'colors.hex', inputs.hex),
        field('color-rgb', 'colors.rgb', inputs.rgb),
        field('color-hsl', 'colors.hsl', inputs.hsl),
        field('color-oklch', 'colors.oklch', inputs.oklch),
        error,
      ]),
    ]),
    table,
    el('div', { class: 'actions' }, [copyButton, downloadButton]),
  );

  const paint = (color: ColorValue, source?: Channel) => {
    current = color;
    swatch.style.backgroundColor = formatHex(color);
    gamut.hidden = !color.outOfGamut;
    const values: Record<Channel, string> = {
      hex: formatHex(color),
      rgb: formatRgb(color),
      hsl: formatHsl(color),
      oklch: formatOklch(color),
    };
    (Object.keys(inputs) as Channel[]).forEach((channel) => {
      if (channel !== source) inputs[channel].value = values[channel];
      inputs[channel].removeAttribute('aria-invalid');
    });
    const onBlack = contrast(color, BLACK);
    const onWhite = contrast(color, WHITE);
    blackRatio.textContent = formatRatio(onBlack.ratio);
    whiteRatio.textContent = formatRatio(onWhite.ratio);
    blackScore.textContent = t(`colors.score.${onBlack.score}`);
    whiteScore.textContent = t(`colors.score.${onWhite.score}`);
    blackScore.className = onBlack.score === 'fail' ? 'fail' : '';
    whiteScore.className = onWhite.score === 'fail' ? 'fail' : '';
    showMessage(error, '');
  };

  const read = (source: Channel, commit: boolean) => {
    const parsed = PARSERS[source](inputs[source].value);
    if (!parsed.ok) {
      inputs[source].setAttribute('aria-invalid', 'true');
      showMessage(error, formatError(parsed.error));
      return;
    }
    if (commit) inputs[source].value = formatOf(source, parsed.value);
    paint(parsed.value, commit ? undefined : source);
  };

  (Object.keys(inputs) as Channel[]).forEach((channel) => {
    inputs[channel].addEventListener('input', () => read(channel, false));
    inputs[channel].addEventListener('blur', () => read(channel, true));
  });

  const summary = () => {
    const onBlack = contrast(current, BLACK);
    const onWhite = contrast(current, WHITE);
    return [
      `${t('colors.hex')}  ${formatHex(current)}`,
      `${t('colors.rgb')}  ${formatRgb(current)}`,
      `${t('colors.hsl')}  ${formatHsl(current)}`,
      `${t('colors.oklch')}  ${formatOklch(current)}`,
      `${t('colors.againstBlack')}  ${formatRatio(onBlack.ratio)}  ${t(`colors.score.${onBlack.score}`)}`,
      `${t('colors.againstWhite')}  ${formatRatio(onWhite.ratio)}  ${t(`colors.score.${onWhite.score}`)}`,
    ].join('\n');
  };

  wireCopy(copyButton, summary);
  downloadButton.addEventListener('click', () => downloadText(summary(), t('colors.outputName')));
  paint(current);
  inputs.hex.value = formatHex(current);

  return onLanguageChange(() => paint(current));
}

function formatOf(channel: Channel, color: ColorValue): string {
  if (channel === 'hex') return formatHex(color);
  if (channel === 'rgb') return formatRgb(color);
  if (channel === 'hsl') return formatHsl(color);
  return formatOklch(color);
}
