import { applyI18n, getLang, onLanguageChange, setLanguage, t } from '../i18n';
import { parseHash, ROUTES, type RouteId } from '../lib/route';
import { DYNAMOGIC_URL } from '../site';
import { announce } from './announce';
import { el } from './dom';
import { mountColors } from './views/colors';
import { mountData } from './views/data';
import { mountEncoding } from './views/encoding';
import { mountImages } from './views/images';
import { mountUnits } from './views/units';

const mounts: Record<RouteId, (root: HTMLElement) => () => void> = {
  images: mountImages,
  data: mountData,
  encoding: mountEncoding,
  colors: mountColors,
  units: mountUnits,
};

const THEME_KEY = 'convert.theme';
/** Keep in sync with public/theme-init.js. */
const THEME_COLOR = { light: '#F5F3EE', dark: '#0E0F11' } as const;

export function start(): void {
  const storedTheme = readTheme();
  if (storedTheme) document.documentElement.setAttribute('data-theme', storedTheme);

  const app = document.getElementById('app');
  if (!app) return;

  const skip = el('a', { class: 'skip', href: '#main', 'data-i18n': 'skip' }, [t('skip')]);
  const themeButton = el('button', { type: 'button', class: 'button button-secondary', id: 'theme' });
  const fr = el('button', { type: 'button', 'data-i18n': 'lang.fr', 'data-i18n-attr': 'aria-label:lang.frLabel' }, [
    t('lang.fr'),
  ]);
  const en = el('button', { type: 'button', 'data-i18n': 'lang.en', 'data-i18n-attr': 'aria-label:lang.enLabel' }, [
    t('lang.en'),
  ]);
  fr.setAttribute('aria-label', t('lang.frLabel'));
  en.setAttribute('aria-label', t('lang.enLabel'));
  const langGroup = el('div', { class: 'lang', role: 'group', 'data-i18n-attr': 'aria-label:lang.group' }, [fr, en]);
  langGroup.setAttribute('aria-label', t('lang.group'));

  const tabs = el('div', { class: 'tablist', role: 'tablist', 'data-i18n-attr': 'aria-label:nav.label' });
  tabs.setAttribute('aria-label', t('nav.label'));
  const tabButtons = new Map<RouteId, HTMLButtonElement>();
  for (const route of ROUTES) {
    const button = el('button', {
      type: 'button',
      class: 'tab',
      role: 'tab',
      id: `tab-${route}`,
      'aria-controls': 'panel',
      'data-i18n': `tab.${route}`,
    }, [t(`tab.${route}`)]);
    button.addEventListener('click', () => {
      const next = `#/${route}`;
      if (location.hash !== next) location.hash = next;
    });
    tabButtons.set(route, button);
    tabs.append(button);
  }

  const panel = el('div', { id: 'panel', role: 'tabpanel' });
  const main = el('main', { id: 'main', tabindex: '-1' }, [panel]);
  const crash = el('p', { class: 'message crash', role: 'alert', 'data-i18n': 'app.crash' }, [t('app.crash')]);
  crash.hidden = true;
  const status = el('p', { id: 'status', class: 'sr', role: 'status' });
  const footerCredit = el('span', { 'data-i18n': 'footer.credit' }, [t('footer.credit')]);

  app.append(
    skip,
    el('header', { class: 'top' }, [
      el('div', { class: 'brand' }, [
        el('p', { class: 'wordmark', 'data-i18n': 'brand' }, [t('brand')]),
        el('p', { class: 'tagline', 'data-i18n': 'tagline' }, [t('tagline')]),
      ]),
      el('div', { class: 'tools' }, [langGroup, themeButton]),
    ]),
    el('nav', { 'data-i18n-attr': 'aria-label:nav.label' }, [tabs]),
    main,
    crash,
    status,
    el('footer', {}, [
      el('p', { class: 'hint', 'data-i18n': 'footer.privacy' }, [t('footer.privacy')]),
      el('a', { class: 'credit', href: DYNAMOGIC_URL }, [
        el('img', {
          class: 'mark',
          src: `${import.meta.env.BASE_URL}mark.svg`,
          alt: '',
          width: '24',
          height: '24',
        }),
        footerCredit,
      ]),
    ]),
  );
  const nav = app.querySelector('nav');
  if (nav) nav.setAttribute('aria-label', t('nav.label'));

  let cleanup = () => {};

  const paintTheme = () => {
    const dark = activeTheme() === 'dark';
    themeButton.textContent = t(dark ? 'theme.toLight' : 'theme.toDark');
    themeButton.setAttribute('aria-label', t(dark ? 'theme.toLightLabel' : 'theme.toDarkLabel'));
    themeButton.setAttribute('aria-pressed', dark ? 'true' : 'false');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[dark ? 'dark' : 'light']);
  };

  const paintLang = () => {
    const current = getLang();
    fr.setAttribute('aria-pressed', current === 'fr' ? 'true' : 'false');
    en.setAttribute('aria-pressed', current === 'en' ? 'true' : 'false');
  };

  const render = () => {
    const route = parseHash(location.hash);
    cleanup();
    panel.replaceChildren();
    panel.setAttribute('aria-labelledby', `tab-${route}`);
    cleanup = mounts[route](panel);
    for (const [id, button] of tabButtons) {
      const selected = id === route;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    }
    document.title = t('meta.titleWith', { section: t(`tab.${route}`) });
  };

  fr.addEventListener('click', () => setLanguage('fr'));
  en.addEventListener('click', () => setLanguage('en'));
  themeButton.addEventListener('click', () => {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    persist(THEME_KEY, next);
    paintTheme();
  });
  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const order = [...tabButtons.values()];
    const index = order.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : event.key === 'ArrowRight' ? (index + 1) % order.length : (index - 1 + order.length) % order.length;
    order[next].focus();
    order[next].click();
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
  window.addEventListener('error', () => {
    crash.hidden = false;
  });
  window.addEventListener('unhandledrejection', () => {
    crash.hidden = false;
  });

  onLanguageChange(() => {
    paintTheme();
    paintLang();
    document.title = t('meta.titleWith', { section: t(`tab.${parseHash(location.hash)}`) });
  });

  setLanguage(getLang());
  applyI18n(document);
  paintTheme();
  paintLang();
  if (!location.hash) history.replaceState(null, '', '#/images');
  render();
  announce('');
}

function activeTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function readTheme(): 'light' | 'dark' | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // Ignore storage failures.
  }
  return null;
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}
