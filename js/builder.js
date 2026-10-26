// Builds the form from OPTIONS (see options.js). To support a new option *type*,
// add a factory to `controls` below. Each factory returns { node, get(), set(v) }.

import { OPTIONS, GROUPS, parseValue, parseOptions, buildQuery } from './options.js';
import { loadSheet } from './sheets.js';
import { UserError, el, debounce } from './util.js';

const form = document.getElementById('form');
const urlInput = document.getElementById('embed-url');
const copyButton = document.getElementById('copy');
const urlNote = document.getElementById('url-note');
const frame = document.getElementById('frame');
const preview = document.getElementById('preview');
const sizes = document.getElementById('sizes');
const columnList = document.getElementById('columns');

const idFor = (option) => `opt-${option.key}`;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- control factories --------------------------------------------------------

const controls = {
  text(option, ctx) {
    const input = el('input', {
      type: 'text', id: idFor(option), name: option.key,
      placeholder: option.placeholder || '', spellcheck: 'false',
    });
    input.addEventListener('input', ctx.onChange);
    return { node: input, get: () => input.value, set: (v) => { input.value = v; } };
  },

  field(option, ctx) {
    const control = controls.text(option, ctx);
    control.node.placeholder = option.placeholder || 'Automatic';
    control.node.setAttribute('list', 'columns'); // suggestions come from the loaded sheet
    return control;
  },

  number(option, ctx) {
    const input = el('input', {
      type: 'number', id: idFor(option), name: option.key, inputmode: 'numeric',
      min: option.min, max: option.max, step: option.integer ? 1 : 'any',
      placeholder: option.default !== undefined ? String(option.default) : 'Auto',
    });
    input.addEventListener('input', ctx.onChange);
    const node = el('div', { class: 'with-unit' }, input, option.unit && el('span', { class: 'unit', text: option.unit }));
    return { node, get: () => input.value, set: (v) => { input.value = v; } };
  },

  select(option, ctx) {
    const fallback = option.default ?? option.choices[0];
    const select = el(
      'select', { id: idFor(option), name: option.key },
      option.choices.map((c) => el('option', { value: c, text: capitalize(c) }))
    );
    select.value = fallback;
    select.addEventListener('input', ctx.onChange);
    return {
      node: select,
      get: () => select.value,
      set: (v) => {
        const match = option.choices.find((c) => c.toLowerCase() === String(v).toLowerCase());
        select.value = match ?? fallback;
      },
    };
  },

  color(option, ctx) {
    const text = el('input', {
      type: 'text', id: idFor(option), name: option.key, maxlength: 7,
      placeholder: option.default, spellcheck: 'false',
    });
    const picker = el('input', { type: 'color', value: option.default, 'aria-label': `${option.label}, color picker` });
    text.addEventListener('input', () => {
      const r = parseValue(option, text.value);
      if (r.value) picker.value = r.value;
      ctx.onChange();
    });
    picker.addEventListener('input', () => { text.value = picker.value; ctx.onChange(); });
    return {
      node: el('div', { class: 'color-field' }, picker, text),
      get: () => text.value,
      set: (v) => {
        text.value = v;
        picker.value = parseValue(option, v).value || option.default;
      },
    };
  },
};

// ---- build the form -----------------------------------------------------------

const entries = new Map(); // key -> { option, control, row, error }
const fieldsets = [];
const sheetStatus = el('p', { class: 'sheet-status', role: 'status' });

function build() {
  for (const group of GROUPS) {
    const members = OPTIONS.filter((o) => o.group === group.id);
    if (!members.length) continue;
    const fieldset = el('fieldset', { class: 'group' }, el('legend', { text: group.label }));
    for (const option of members) {
      const factory = controls[option.type] || controls.text;
      const control = factory(option, { onChange: () => changed(option) });
      const error = el('p', { class: 'error', hidden: true });
      const row = el(
        'div', { class: 'row' },
        el('label', { for: idFor(option), text: option.label }),
        control.node,
        option.help && el('p', { class: 'help', text: option.help }),
        error
      );
      fieldset.append(row);
      entries.set(option.key, { option, control, row, error });
    }
    if (group.id === 'source') fieldset.append(sheetStatus); // live "found N columns" check
    fieldsets.push(fieldset);
    form.append(fieldset);
  }
  form.append(el('button', { type: 'button', class: 'reset', onclick: reset, text: 'Reset all' }));
}

// ---- state -> URL + preview ---------------------------------------------------

function readRaw() {
  return Object.fromEntries([...entries].map(([key, e]) => [key, e.control.get()]));
}

let shownPreview = '';
const setPreview = debounce((href) => {
  if (href === shownPreview) return;
  shownPreview = href;
  if (href) { preview.src = href; frame.removeAttribute('data-empty'); }
  else { preview.removeAttribute('src'); frame.setAttribute('data-empty', ''); }
}, 350);

function update() {
  const raw = readRaw();
  const values = {};
  const errors = {};
  for (const option of OPTIONS) {
    const result = parseValue(option, raw[option.key]);
    if (result.error) errors[option.key] = result.error;
    else if (result.value !== undefined) values[option.key] = result.value;
  }

  const effective = (key) => values[key] ?? entries.get(key)?.option.default;
  const isVisible = (option) =>
    !option.showIf || Object.entries(option.showIf).every(([k, v]) => effective(k) === v);

  for (const { option, row, error } of entries.values()) {
    row.hidden = !isVisible(option);
    const message = errors[option.key];
    error.hidden = !message;
    error.textContent = message || '';
  }
  for (const fieldset of fieldsets) {
    fieldset.hidden = [...fieldset.querySelectorAll('.row')].every((r) => r.hidden);
  }

  if (!values.uid) {
    urlInput.value = '';
    copyButton.disabled = true;
    urlNote.textContent = '';
    setPreview('');
    return;
  }

  const shown = Object.fromEntries(
    Object.entries(values).filter(([key]) => isVisible(entries.get(key).option))
  );
  const url = new URL('google-sheets.html', location.href);
  url.search = buildQuery(shown);
  urlInput.value = url.href;

  const hasErrors = Object.keys(errors).length > 0;
  copyButton.disabled = hasErrors;
  urlNote.textContent = hasErrors ? 'Fix the highlighted fields to use this link.' : '';
  setPreview(url.href);
}

// ---- sheet check (fills column suggestions) -----------------------------------

let checkToken = 0;
function fillColumns(headers) {
  columnList.replaceChildren(...headers.map((h) => el('option', { value: h })));
}
function setSheetStatus(text, state = '') {
  sheetStatus.textContent = text;
  sheetStatus.dataset.state = state;
}

async function checkSheet() {
  const token = ++checkToken;
  const raw = readRaw();
  if (!raw.uid.trim()) { fillColumns([]); setSheetStatus(''); return; }
  setSheetStatus('Checking the sheet…', 'busy');
  try {
    const table = await loadSheet({ uid: raw.uid, sheet: raw.sheet.trim(), cacheSeconds: 0 });
    if (token !== checkToken) return;
    fillColumns(table.headers);
    setSheetStatus(`Found ${table.headers.length} columns and ${table.rows.length} rows.`, 'ok');
  } catch (err) {
    if (token !== checkToken) return;
    fillColumns([]);
    setSheetStatus(
      err instanceof UserError ? [err.headline, ...err.details].join(' ') : 'Couldn’t check the sheet.',
      'error'
    );
  }
}
const scheduleCheck = debounce(checkSheet, 600);

function changed(option) {
  update();
  if (option.key === 'uid' || option.key === 'sheet') scheduleCheck();
}

function reset() {
  for (const { control } of entries.values()) control.set('');
  update();
  checkSheet();
}

// ---- wiring -------------------------------------------------------------------

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(urlInput.value);
  } catch {
    urlInput.select();
    try { document.execCommand('copy'); } catch { /* user can copy manually */ }
  }
  copyButton.textContent = 'Copied';
  setTimeout(() => { copyButton.textContent = 'Copy link'; }, 1500);
});

sizes.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  for (const b of sizes.children) b.setAttribute('aria-pressed', String(b === button));
  frame.style.width = button.dataset.width ? `${button.dataset.width}px` : '';
});

build();
// If opened from an embed's error message, start from that embed's settings.
const { raw: initial } = parseOptions(location.search);
for (const [key, { control }] of entries) control.set(initial[key] ?? '');
update();
checkSheet();
