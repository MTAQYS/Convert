import { t } from '../i18n';

type Attrs = Record<string, string | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function field(id: string, labelKey: string, control: HTMLElement, hintKey?: string): HTMLElement {
  const wrap = el('div', { class: 'field' });
  const label = el('label', { for: id, 'data-i18n': labelKey });
  label.textContent = t(labelKey);
  control.id = id;
  wrap.append(label, control);
  if (hintKey) {
    const hint = el('p', { class: 'hint', id: `${id}-hint`, 'data-i18n': hintKey });
    hint.textContent = t(hintKey);
    const described = control.getAttribute('aria-describedby');
    control.setAttribute('aria-describedby', described ? `${described} ${id}-hint` : `${id}-hint`);
    wrap.append(hint);
  }
  return wrap;
}

export function setOptions(select: HTMLSelectElement, options: { value: string; labelKey: string }[]): void {
  const current = select.value;
  select.replaceChildren();
  for (const option of options) {
    const node = document.createElement('option');
    node.value = option.value;
    node.dataset.i18n = option.labelKey;
    node.textContent = t(option.labelKey);
    select.append(node);
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

export function messageBox(): HTMLParagraphElement {
  return el('p', { class: 'message', role: 'alert' });
}

export function showMessage(node: HTMLElement, text: string): void {
  node.textContent = text;
  node.hidden = text === '';
}

export function bindDrop(zone: HTMLElement, onFiles: (files: File[]) => void): void {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', (event) => {
    if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return;
    zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length > 0) onFiles(files);
  });
}

export function onShortcut(area: HTMLTextAreaElement, action: () => void): void {
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      action();
    }
  });
}
