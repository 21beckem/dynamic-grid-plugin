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
