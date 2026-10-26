import type { ConvertError } from '../lib/errors';
import en from './en.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };

export type Lang = 'fr' | 'en';

const dictionaries: Record<Lang, Record<string, string>> = { fr, en };

let lang: Lang = detectLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let text = dictionaries[lang][key] ?? dictionaries.fr[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function formatError(error: ConvertError): string {
  return t(`error.${error.code}`, {
    line: error.line ?? '?',
    column: error.column ?? '?',
    detail: error.detail ?? '',
  });
}

export function setLanguage(next: Lang): void {
  lang = next;
  persist('convert.lang', next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    applyI18n(document);
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta.description'));
  }
  for (const listener of listeners) listener();
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyI18n(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((node) => {
    const spec = node.getAttribute('data-i18n-attr');
    if (!spec) return;
    for (const part of spec.split(',')) {
      const index = part.indexOf(':');
      if (index === -1) continue;
      node.setAttribute(part.slice(0, index).trim(), t(part.slice(index + 1).trim()));
    }
  });
}

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem('convert.lang');
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    // Storage can throw in private mode and in tests.
  }
  return 'fr';
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures. The choice still applies to this page.
  }
}
