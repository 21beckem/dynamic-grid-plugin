import { parseOptions } from './options.js';
import { loadSheet } from './sheets.js';
import { compileField } from './fields.js';
import { views } from './views/index.js';
import { UserError, el } from './util.js';

const root = document.getElementById('app');

function applyAppearance(values) {
  const html = document.documentElement;
  const style = html.style;
  html.dataset.theme = values.theme;
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

function builderHref() {
  const url = new URL('./builder/', location.href);
  url.search = location.search; // carry the current settings into the builder
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
      }))
      .filter((item) => item.title || item.description || item.image || item.link);
    if (values.limit) items = items.slice(0, values.limit);

    if (!items.length) {
      showNotice('Nothing to show.', ['This tab has no rows with content, or the chosen columns are empty.']);
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

main();
