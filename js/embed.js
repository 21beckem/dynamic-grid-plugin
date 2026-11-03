import { parseOptions } from './options.js';
import { loadSheet } from './sheets.js';
import { compileField } from './fields.js';
import { views } from './views/index.js';
import { UserError, el, openModal } from './util.js';

const root = document.getElementById('app');

function applyAppearance(values) {
  const html = document.documentElement;
  const style = html.style;
  html.dataset.theme = values.theme;
  html.dataset.backgroundTheme = values.background;
  style.setProperty('--accent', values.accent);
  style.setProperty('--gap', `${values.gap}px`);
  style.setProperty('--min', `${values.minWidth}px`);
  style.setProperty('--aspect', values.aspect.replace(':', ' / '));
  if (values.columns) {
    html.dataset.cols = 'fixed';
    style.setProperty('--cols', values.columns);
    style.setProperty('--cols-md', Math.min(values.columns, 2));
  }
}

function builderHref(includeQuery = true) {
  const url = new URL('./builder/', location.href);
  if (includeQuery) {
    url.search = location.search; // carry the current settings into the builder
  }
  return url.href;
}

function showNotice(headline, details = []) {
  root.setAttribute('aria-busy', 'false');
  root.replaceChildren(
    el(
      'section',
      { class: 'notice', role: 'alert' },
      el('h2', { class: 'notice-title', text: headline }),
      details.length ? el('ul', { class: 'notice-list' }, details.map((d) => el('li', { text: d }))) : null,
      el('a', { class: 'notice-link', href: builderHref(), target: '_blank', rel: 'noopener' }, 'Open the builder to fix this')
    )
  );
}

function showMessage(headline, details = []) {
  root.setAttribute('aria-busy', 'false');
  const showDetails = (headline ?? '').includes('{{details}}');
  if (showDetails) headline = headline.replace('{{details}}', '');
  root.replaceChildren(
    el(
      'section',
      { style: 'text-align: center;', },
      el('h2', { }, headline),
      showDetails && details.length ? el('ul', details.map((d) => el('li', { text: d }))) : null
    )
  );
}

function postBuilderMessage(message) {
  if (window.parent !== window) window.parent.postMessage(message, location.origin);
}

let contextHighlight = null;
let contextCard = null;

function clearContextHighlight() {
  contextHighlight?.remove();
  contextHighlight = null;
}

function clearContextSession() {
  clearContextHighlight();
  contextCard = null;
}

function highlightContextElement(element) {
  clearContextHighlight();
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const computed = getComputedStyle(element);
  contextHighlight = el('div', {
    class: 'context-highlight',
    'aria-hidden': 'true',
  });
  contextHighlight.style.left = `${rect.left}px`;
  contextHighlight.style.top = `${rect.top}px`;
  contextHighlight.style.width = `${rect.width}px`;
  contextHighlight.style.height = `${rect.height}px`;
  contextHighlight.style.borderRadius = computed.borderRadius;
  document.body.append(contextHighlight);
}

function selectedContextElement(event, card) {
  const target = event.target instanceof Element ? event.target : null;
  return target?.closest('.card-media, .card-title, .card-desc, .card-body') || card;
}

function updateContextHighlightPosition() {
  if (!contextHighlight) return;
  const element = contextHighlight.__target;
  if (!element?.isConnected) return clearContextHighlight();
  const rect = element.getBoundingClientRect();
  contextHighlight.style.left = `${rect.left}px`;
  contextHighlight.style.top = `${rect.top}px`;
  contextHighlight.style.width = `${rect.width}px`;
  contextHighlight.style.height = `${rect.height}px`;
}

function setContextHighlight(element) {
  highlightContextElement(element);
  if (contextHighlight) contextHighlight.__target = element;
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type === 'dynamic-grid-clear-context-highlight') clearContextSession();
  if (event.data?.type === 'dynamic-grid-highlight-context' && event.data.target === 'card' && contextCard)
    setContextHighlight(contextCard);
});

addEventListener('scroll', updateContextHighlightPosition, { passive: true });
addEventListener('resize', updateContextHighlightPosition);

function previewTarget(event, card) {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.card-media')) return 'image';
  if (target?.closest('.card-title')) return 'title';
  if (target?.closest('.card-desc')) return 'description';
  if (target?.closest('.card-body')) return 'body';
  return card ? 'card' : '';
}

document.addEventListener('pointerdown', (event) => {
  if (event.button === 0) {
    clearContextSession();
    postBuilderMessage({ type: 'dynamic-grid-preview-pointerdown' });
  }
});

document.addEventListener('contextmenu', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest('.card');
  if (!card) return;
  event.preventDefault();
  contextCard = card;
  setContextHighlight(selectedContextElement(event, card));
  postBuilderMessage({
    type: 'dynamic-grid-context-menu',
    target: previewTarget(event, card),
    x: event.clientX,
    y: event.clientY,
    hasLink: card.matches('a.card') && Boolean(card.getAttribute('href')),
    hasTitle: Boolean(card.querySelector('.card-title')?.textContent.trim()),
    hasDescription: Boolean(card.querySelector('.card-desc')?.textContent.trim()),
  });
});

async function main() {
  const { values, errors } = parseOptions(location.search);
  applyAppearance(values);
  if (errors.length) {
    showNotice('This embed link has a problem.', errors);
    return;
  }

  try {
    const table = await loadSheet({ uid: values.uid, sheet: values.sheet });
    const fields = {
      title: compileField(values.title, table.headers, 'title'),
      description: compileField(values.description, table.headers, 'description'),
      image: compileField(values.image, table.headers, 'image'),
      link: compileField(values.link, table.headers, 'link'),
    };

    let items = table.rows
      .map((row) => ({
        title: fields.title.get(row),
        description: fields.description.get(row),
        image: fields.image.get(row),
        link: fields.link.get(row),
        linkTarget: values.linkTarget,
        enableImage: values.enableImage !== '0', // just in case enableImage is undefined, treat it as enabled
      }))
      .filter((item) => item.title || item.description || item.image || item.link);
    if (values.limit) items = items.slice(0, values.limit);

    if (!items.length) {
      showMessage(values.emptyMessage, ['This tab has no rows with content, or the chosen columns are empty.']);
      return;
    }

    const view = views[values.view] || views.grid;
    view.render(root, items, {
      hasImage: fields.image.kind !== 'none',
      columns: values.columns,
      autoplay: values.autoplay,
      styles: values.styles,
    });
    root.setAttribute('aria-busy', 'false');
  } catch (err) {
    if (err instanceof UserError) showNotice(err.headline, err.details);
    else {
      console.error(err);
      showNotice('Something went wrong.', [String((err && err.message) || err)]);
    }
  }
}

// watermark
document.addEventListener('DOMContentLoaded', () => {
  const watermark = el('span', { class: 'watermark' }, 'Dynamic Grid Plugin');
  watermark.addEventListener('click', () => {
    console.log('watermark clicked');
    openModal(el('div', { 'style': 'font-size: small;' },
      el('h2',{ style: 'margin: 0;' }, 'Dynamic Grid Plugin'),
      el('p', { style: 'margin-top: 0; font-size: small;' }, 'Created by ', el('a', { style: 'color: inherit;', href: 'https://github.com/21beckem/', target: '_blank', rel: 'noopener noreferrer' }, 'Michael Becker'), '.'),
      el('p', {}, 'This embed was created with the Dynamic Grid Plugin for Google Sheets.'),
      el('p', {}, 'You can use ', el('a', { style: 'color: inherit;', href: builderHref(), target: '_blank', rel: 'noopener noreferrer' }, 'the builder'), ' to customize this embed or create your own.')
    ));
  });
  document.body.append(watermark);
});

main();
