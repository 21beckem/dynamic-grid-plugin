// Builds the form from OPTIONS (see options.js). To support a new option *type*,
// add a factory to `controls` below. Each factory returns { node, get(), set(v) }.

import { OPTIONS, GROUPS, parseValue, parseOptions, buildQuery } from './options.js';
import { loadSheet, parseSheetId } from './sheets.js';
import { UserError, el, debounce } from './util.js';
import { createEditableControl, dropColumnDragAtPoint, insertIntoLastFocusedEditor, updateColumnDragAtPoint } from './editable.js';
import { createStyleControl } from './style-editor.js';
import { STYLE_PROPERTIES } from './styles.js';

const form = document.getElementById('form');
const urlInput = document.getElementById('embed-url');
const copyButton = document.getElementById('copy');
const urlNote = document.getElementById('url-note');
const frame = document.getElementById('frame');
const preview = document.getElementById('preview');
const sizes = document.getElementById('sizes');
const columnBank = document.getElementById('column-bank');
const columnChips = document.getElementById('column-chips');
const contextMenu = document.getElementById('context-menu');

const idFor = (option) => `opt-${option.key}`;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- control factories --------------------------------------------------------

const controls = {
  text(option, ctx = { onChange:()=>{} }) {
    const control = createEditableControl(option, {
      onChange: ctx.onChange,
      allowColumns: !['uid', 'sheet'].includes(option.key),
      reservedTokens: option.key === 'emptyMessage' ? ['details'] : [],
    });
    control.node.querySelector('.editable')?.setAttribute('name', option.key);
    return control;
  },

  field(option, ctx = { onChange:()=>{} }) {
    return createEditableControl(option, {
      onChange: ctx.onChange,
      placeholder: option.placeholder || 'Automatic',
      allowColumns: true,
    });
  },

  textarea(option, ctx = { onChange:()=>{} }) {
    return createEditableControl(option, {
      onChange: ctx.onChange,
      multiline: true,
      allowColumns: !['uid', 'sheet'].includes(option.key),
    });
  },

  textareaField(option, ctx = { onChange:()=>{} }) {
    return createEditableControl(option, {
      onChange: ctx.onChange,
      placeholder: option.placeholder || 'Automatic',
      multiline: true,
      allowColumns: true,
    });
  },

  number(option, ctx = { onChange:()=>{} }) {
    const input = el('input', {
      type: 'number', id: idFor(option), name: option.key, inputmode: 'numeric',
      min: option.min, max: option.max, step: option.integer ? 1 : 'any',
      placeholder: option.default !== undefined ? String(option.default) : 'Auto',
    });
    input.addEventListener('input', ctx.onChange);
    const node = el('div', { class: 'with-unit' }, input, option.unit && el('span', { class: 'unit', text: option.unit }));
    return { node, get: () => input.value, set: (v) => { input.value = v; }, onChange: ctx.onChange };
  },

  select(option, ctx = { onChange:()=>{} }) {
    if (option.values) {
      if (option.values.length !== option.choices.length)
        throw new Error(`Option ${option.key} has mismatched values and choices.`);
    } else {
      option.values = option.choices;
    }
    const fallback = option.default ?? option.values[0];
    const select = el(
      'select', { id: idFor(option), name: option.key },
      option.choices.map((c, i) => el('option', { value: option.values[i], text: capitalize(c) }))
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
      onChange: ctx.onChange
    };
  },

  color(option, ctx = { onChange:()=>{} }) {
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
      onChange: ctx.onChange
    };
  },

  styles(option, ctx = { onChange:()=>{} }) {
    return createStyleControl(option, { onChange: ctx.onChange });
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
    const fieldset = el('fieldset', { class: 'group-fields', 'aria-label': group.label });
    const section = el(
      'details',
      { class: 'group', open: group.id === 'source' },
      el('summary', { class: 'group-summary', text: group.label }),
      fieldset
    );
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
    fieldsets.push(section);
    form.append(section);
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
  const url = new URL('../', location.href);
  url.search = buildQuery(shown);
  urlInput.value = url.href;

  const hasErrors = Object.keys(errors).length > 0;
  copyButton.disabled = hasErrors;
  urlNote.textContent = hasErrors ? 'Fix the highlighted fields to use this link.' : '';
  setPreview(url.href);
}

// ---- preview context menu ----------------------------------------------------

const CONTEXT_TARGETS = new Set(['card', 'image', 'body', 'title', 'description']);
const CONTEXT_LABELS = {
  card: 'Card',
  image: 'Image',
  body: 'Card body',
  title: 'Title',
  description: 'Description',
};
const CONTEXT_ICON_PATHS = {
  card: 'M4 4h16v16H4z',
  content: 'M5 6h14M5 12h14M5 18h14',
  style: 'M4 16c0-5 3.5-9 8-9s8 4 8 9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-4 0v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
  Color: 'M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2c0-1.1-.9-2-2-2h-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a4 4 0 0 0 4-4 9 9 0 0 0-8-6Z',
  Image: 'M4 5h16v14H4z M7 15l3-3 2 2 2-2 3 3 M8 9h.01',
  Spacing: 'M4 12h16 M8 8l-4 4 4 4 M16 8l4 4-4 4',
  Surface: 'm4 8 8-4 8 4-8 4-8-4Z M4 12l8 4 8-4 M4 16l8 4 8-4',
  Typography: 'M5 5h14 M12 5v14 M8 19h8',
};
let contextState = null;
let contextPosition = null;

function contextIcon(name) {
  const path = CONTEXT_ICON_PATHS[name];
  if (!path) return null;
  return el(
    'svg',
    { class: 'context-menu-icon', viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' },
    el('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  );
}

function closeContextMenu() {
  if (preview.contentWindow) {
    preview.contentWindow.postMessage({ type: 'dynamic-grid-clear-context-highlight' }, location.origin);
  }
  contextState = null;
  contextPosition = null;
  contextMenu.hidden = true;
  contextMenu.replaceChildren();
}

function focusBuilderOption(key) {
  const entry = entries.get(key);
  if (!entry) return;
  const section = entry.row.closest('details.group');
  if (section) section.open = true;
  entry.row.hidden = false;
  entry.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const focusable = entry.control.node.querySelector('.editable, input, select, textarea, [contenteditable="true"]');
  focusable?.focus({ preventScroll: true });
}

function focusBuilderStyle(target, propertyKey) {
  const entry = entries.get('styles');
  if (!entry || typeof entry.control.focusProperty !== 'function') return;
  const section = entry.row.closest('details.group');
  if (section) section.open = true;
  entry.row.hidden = false;
  entry.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  entry.control.focusProperty(target, propertyKey);
}

function contextAction(label, action, iconName = '', { keepOpen = false, primary = false } = {}) {
  const button = el(
    'button',
    { type: 'button', class: `context-menu-item${primary ? ' context-menu-item--primary' : ''}`, role: 'menuitem' },
    contextIcon(iconName),
    el('span', { text: label })
  );
  button.addEventListener('click', () => {
    if (!keepOpen) closeContextMenu();
    action();
  });
  return button;
}

function contextSection(label, children, iconName) {
  return el(
    'section',
    { class: 'context-menu-section' },
    el('h2', { class: 'context-menu-heading' }, contextIcon(iconName), el('span', { text: label })),
    el('div', { class: 'context-menu-grid' }, children)
  );
}

function styleMenu(target) {
  const properties = STYLE_PROPERTIES.filter((property) => property.targets.includes(target));
  const categories = [...new Set(properties.map((property) => property.category))].sort();
  const grouped = new Map(categories.map((category) => [category, []]));
  for (const property of properties) grouped.get(property.category).push(property);
  return categories.map((category) => {
    const members = grouped.get(category);
    if (!members?.length) return null;
    const group = el('details', { class: 'context-menu-group', open: true });
    group.append(
      el('summary', {}, contextIcon(category), el('span', { text: category })),
      el('div', { class: 'context-menu-grid' }, members.map((property) => contextAction(property.label, () => focusBuilderStyle(target, property.key))))
    );
    return group;
  }).filter(Boolean);
}

function contentActions(context) {
  const actions = [
    context.hasLink
      ? contextAction('Change Link Destination', () => focusBuilderOption('link'))
      : contextAction('Add Click destination', () => focusBuilderOption('link')),
  ];

  if (context.target === 'image') {
    actions.push(contextAction('Change Source', () => focusBuilderOption('image')));
  } else if (context.target === 'title') {
    actions.push(contextAction('Change Source', () => focusBuilderOption('title')));
  } else if (context.target === 'description') {
    actions.push(contextAction('Change Source', () => focusBuilderOption('description')));
  } else if (context.target === 'body' || context.target === 'card') {
    actions.push(
      context.hasTitle
        ? contextAction('Change Title Source', () => focusBuilderOption('title'))
        : contextAction('Add Title', () => focusBuilderOption('title')),
      context.hasDescription
        ? contextAction('Change Description Source', () => focusBuilderOption('description'))
        : contextAction('Add Description', () => focusBuilderOption('description'))
    );
  }

  if (context.hasLink)
    actions.push(contextAction('Change Link Behavior', () => focusBuilderOption('linkTarget')));
  return actions;
}

function selectWholeCard() {
  if (!contextState) return;
  contextState = { ...contextState, target: 'card' };
  preview.contentWindow?.postMessage({ type: 'dynamic-grid-highlight-context', target: 'card' }, location.origin);
  renderContextMenu();
}

function renderContextMenu() {
  if (!contextState || !contextPosition) return;
  const selectionAction = contextState.target !== 'card'
    ? contextAction('Select Card', selectWholeCard, 'card', { keepOpen: true, primary: true })
    : null;
  contextMenu.replaceChildren(
    el('div', { class: 'context-menu-selection-row' },
      el('p', { class: 'context-menu-selection', text: `Selected: ${CONTEXT_LABELS[contextState.target]}` }),
      selectionAction),
    contextSection('Content', contentActions(contextState), 'content'),
    el('hr', { class: 'context-menu-divider' }),
    contextSection('Style', styleMenu(contextState.target), 'style')
  );
  contextMenu.hidden = false;
  const margin = 8;
  const left = Math.max(margin, Math.min(contextPosition.x, innerWidth - contextMenu.offsetWidth - margin));
  const top = Math.max(margin, Math.min(contextPosition.y, innerHeight - contextMenu.offsetHeight - margin));
  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

function showContextMenu(context, x, y) {
  contextState = context;
  contextPosition = { x, y };
  renderContextMenu();
}

window.addEventListener('message', (event) => {
  if (event.source !== preview.contentWindow) return;
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'dynamic-grid-preview-pointerdown') {
    closeContextMenu();
    return;
  }
  if (message.type !== 'dynamic-grid-context-menu') return;
  const target = CONTEXT_TARGETS.has(message.target) ? message.target : 'card';
  const rect = preview.getBoundingClientRect();
  showContextMenu({
    target,
    hasLink: Boolean(message.hasLink),
    hasTitle: Boolean(message.hasTitle),
    hasDescription: Boolean(message.hasDescription),
  }, rect.left + Number(message.x || 0), rect.top + Number(message.y || 0));
});

document.addEventListener('pointerdown', (event) => {
  if (!contextMenu.contains(event.target)) closeContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeContextMenu();
});
window.addEventListener('blur', closeContextMenu);

// ---- sheet check (fills the draggable column bank) -----------------------------

let checkToken = 0;
let pointerDrag = null;
let dragGhost = null;

function hideColumnBank() {
  columnBank.hidden = true;
}

function showColumnBank(shell) {
  if (!columnChips.children.length) return;
  if (columnBank.previousElementSibling !== shell) shell.after(columnBank);
  columnBank.hidden = false;
}

function syncColumnBankVisibility() {
  if (pointerDrag) return;
  const active = document.activeElement;
  if (active?.closest('.column-bank')) return;
  const shell = active?.closest('.editable-shell');
  if (shell?.dataset.columnTarget === 'true') showColumnBank(shell);
  else hideColumnBank();
}

form.addEventListener('focusin', syncColumnBankVisibility);
form.addEventListener('focusout', () => setTimeout(syncColumnBankVisibility, 0));

function createDragGhost(chip, x, y) {
  dragGhost = el('span', {
    class: 'column-chip column-chip-drag-ghost',
    text: chip.textContent,
    'aria-hidden': 'true',
  });
  document.body.append(dragGhost);
  positionDragGhost(x, y);
}

function positionDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x + 12}px`;
  dragGhost.style.top = `${y + 12}px`;
}

function removeDragGhost() {
  dragGhost?.remove();
  dragGhost = null;
}

function finishPointerDrag(event) {
  if (!pointerDrag || (event.pointerId !== undefined && event.pointerId !== pointerDrag.pointerId)) return;
  if (pointerDrag.dragging && event.type !== 'pointercancel') {
    event.preventDefault();
    dropColumnDragAtPoint(event.clientX, event.clientY, pointerDrag.token);
  }
  pointerDrag.chip.classList.remove('is-dragging');
  removeDragGhost();
  pointerDrag = null;
  syncColumnBankVisibility();
}

document.addEventListener('pointermove', (event) => {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (!pointerDrag.dragging && distance < 5) return;
  pointerDrag.dragging = true;
  pointerDrag.chip.classList.add('is-dragging');
  if (!dragGhost) createDragGhost(pointerDrag.chip, event.clientX, event.clientY);
  positionDragGhost(event.clientX, event.clientY);
  event.preventDefault();
  updateColumnDragAtPoint(event.clientX, event.clientY);
}, { passive: false });

document.addEventListener('pointerup', finishPointerDrag, { passive: false });
document.addEventListener('pointercancel', finishPointerDrag, { passive: false });

function fillColumns(headers) {
  columnChips.replaceChildren(...headers.map((header) => {
    const token = `{{${header}}}`;
    const chip = el('span', {
      class: 'column-chip',
      text: header,
      tabindex: '0',
      role: 'listitem',
      'aria-label': `Insert ${token}`,
    });
    chip.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointerDrag) return;
      event.preventDefault();
      chip.focus({ preventScroll: true });
      chip.setPointerCapture?.(event.pointerId);
      pointerDrag = {
        chip,
        token,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
    });
    chip.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      insertIntoLastFocusedEditor(token);
    });
    return chip;
  }));
  if (!headers.length) hideColumnBank();
  else syncColumnBankVisibility();
}
function setSheetStatus(text, state = '') {
  sheetStatus.textContent = text;
  sheetStatus.dataset.state = state;
}

async function checkSheet() {
  const token = ++checkToken;
  const raw = readRaw();
  if (!raw.uid.trim()) { fillColumns([]); setSheetStatus(''); return; }
  let parsed = parseSheetId(raw.uid);
  if (parsed !== null && parsed.id !== raw.uid.trim()) {
    entries.get('uid').control.set(parsed.id);
    if (parsed.gid)
      entries.get('sheet').control.set(parsed.gid);
    entries.get('uid').control.onChange();
    return;
  }
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
  for (const [key, { control }] of entries) {
    control.set(entries.get(key).option.defaultInBuilder ?? '');
  }
  update();
  checkSheet();
}

function seedEntries(initial) {
  for (const [key, { control }] of entries) {
    control.set(initial[key] ?? entries.get(key).option.defaultInBuilder ?? '');
  }
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
seedEntries(initial);
update();
checkSheet();
