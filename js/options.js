// The single source of truth for every URL option.
//
// The embed (embed.js) parses and validates its URL with this list, and the
// builder (builder.js) generates its form from it. To add an option:
//   1. add an entry to OPTIONS below
//   2. read `values.<key>` where it matters (embed.js, or a view via `ctx`)
// Nothing else needs to change: the builder form, validation, defaults and
// URL output all follow from the entry.
//
// Entry fields:
//   key        URL parameter name (matched case-insensitively)
//   group      id from GROUPS (controls where it appears in the builder)
//   type       'text' | 'field' | 'number' | 'select' | 'color'
//              ('field' = a column name, plain text, or {Column} template)
//              New types: add a parser in PARSERS and a control in builder.js.
//   label/help text shown in the builder
//   default    value used when the param is omitted (omitted from built URLs)
//   required   true if the embed can't work without it
//   min/max/integer/unit   for numbers;  choices for selects
//   showIf     { otherKey: value } shows the option in the builder only when
//              the other option has that value

import { viewNames } from './views/index.js';

export const GROUPS = [
  { id: 'source', label: 'Sheet' },
  { id: 'content', label: 'Card content' },
  { id: 'layout', label: 'Layout' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'carousel', label: 'Carousel' },
];

export const OPTIONS = [
  {
    key: 'uid', group: 'source', type: 'text', required: true,
    label: 'Sheet ID', placeholder: '1AbC…xyz',
    help: 'The long ID in the sheet’s URL, between /d/ and /edit. Pasting the whole URL also works. The sheet must be shared as “Anyone with the link → Viewer”.',
  },
  {
    key: 'sheet', group: 'source', type: 'text',
    label: 'Tab', placeholder: 'First tab',
    help: 'A tab name, or its gid (the number after gid= in the sheet’s URL). Tabs named with only digits must be chosen by gid.',
  },

  {
    key: 'title', group: 'content', type: 'field',
    label: 'Title',
    help: 'A column name, plain text, or a template like {{First}} {{Last}}. When empty, a column named title or name is used, otherwise the first column.',
  },
  {
    key: 'description', group: 'content', type: 'textareaField',
    label: 'Description',
    help: 'Same rules as Title. When empty, a column named description or summary is used if there is one.',
  },
  {
    key: 'image', group: 'content', type: 'field',
    label: 'Image',
    help: 'A column of image URLs. Google Drive share links work. When empty, a column named image or photo is used if there is one. NOTE: If the link to the image is from a form response, the folder with the images usually isn\'t public by default. You may need to open the folder and click "Share" → Change to "anyone with the link".',
  },
  {
    key: 'link', group: 'content', type: 'field',
    label: 'Link',
    help: 'A column of web addresses. Cards open them in a new tab. The cell must contain the address itself, not a hyperlink with other text.',
  },
  {
    key: 'linkTarget', group: 'content', type: 'select', choices: ['New Tab', 'Within the frame', 'Current Tab'], values: ['_blank', '_self', '_parent'], default: '_blank',
    label: 'Link Target',
    help: 'Where card links open. "New Tab" and "Within the frame" are safest and will work in almost all contexts. "Current Tab" opens the link in the same tab, but will only work if the parent page allows it (e.g. not in Google Sites).',
  },
  {
    key: 'emptyMessage', group: 'content', type: 'text', defaultInBuilder: 'No results found {{details}}',
    label: 'Empty Message',
    help: 'A message to display when there are no cards to show.',
  },

  {
    key: 'view', group: 'layout', type: 'select',
    label: 'View', choices: viewNames, default: 'grid',
  },
  {
    key: 'columns', group: 'layout', type: 'number', integer: true, min: 1, max: 12,
    label: 'Columns',
    help: 'An exact number of columns (or visible cards in a carousel). Leave empty to fit as many as the card width allows. Narrow embeds drop to 2, then 1.',
  },
  {
    key: 'minWidth', group: 'layout', type: 'number', integer: true, min: 120, max: 640, default: 220, unit: 'px',
    label: 'Minimum card width',
    help: 'Used when Columns is empty.',
  },
  {
    key: 'enableImage', group: 'layout', type: 'select', choices: ['Yes', 'No'], values: ['1', '0'], default: '1',
    label: 'Enable Images',
    help: 'If "No", cards will not show images even if the Image column is set. This can be used to save space or bandwidth, or to avoid broken images when the Image column is empty.',
  },
  {
    key: 'aspect', group: 'layout', type: 'select', choices: ['16:9', '3:2', '4:3', '1:1', '3:4'], default: '4:3',
    label: 'Image shape', help: 'Width to height ratio of card images.',
  },
  {
    key: 'gap', group: 'layout', type: 'number', integer: true, min: 0, max: 64, default: 16, unit: 'px',
    label: 'Gap between cards',
  },
  {
    key: 'limit', group: 'layout', type: 'number', integer: true, min: 1,
    label: 'Maximum cards', help: 'Show only the first rows. Leave empty to show them all.',
  },

  {
    key: 'background', group: 'appearance', type: 'select', choices: ['Transparent', 'Light', 'Dark'], values: ['transparent', 'light', 'dark'], default: 'transparent',
    label: 'Background',
    help: 'Transparent leaves the page background to he parent page.',
  },
  {
    key: 'theme', group: 'appearance', type: 'select', choices: ['light', 'dark'], default: 'light',
    label: 'Theme',
    help: 'Dark switches the text and cards to a dark palette.',
  },
  {
    key: 'accent', group: 'appearance', type: 'color', default: '#2f5d8a',
    label: 'Accent color', help: 'Used for focus outlines, hover highlights and carousel buttons.',
  },

  {
    key: 'autoplay', group: 'carousel', type: 'number', integer: true, min: 0, max: 60, default: 0, unit: 'sec',
    label: 'Autoplay', showIf: { view: 'carousel' },
    help: 'Seconds between slides. 0 turns autoplay off. It pauses on hover and focus, and is skipped when the visitor prefers reduced motion.',
  },
];

// ---- parsing ------------------------------------------------------------------

function numberError(option) {
  const { min, max, integer } = option;
  const kind = integer ? 'a whole number' : 'a number';
  if (min !== undefined && max !== undefined) return `“${option.key}” must be ${kind} from ${min} to ${max}.`;
  if (min !== undefined) return `“${option.key}” must be ${kind} of ${min} or more.`;
  return `“${option.key}” must be ${kind}.`;
}

const PARSERS = {
  text: (text) => ({ value: text }),
  field: (text) => ({ value: text }),
  textareaField: (text) => ({ value: text }),
  number(text, option) {
    const n = Number(text);
    const bad =
      !Number.isFinite(n) ||
      (option.integer && !Number.isInteger(n)) ||
      (option.min !== undefined && n < option.min) ||
      (option.max !== undefined && n > option.max);
    return bad ? { error: numberError(option) } : { value: n };
  },
  select(text, option) {
    const match = (option.values ?? option.choices).find((c) => c.toLowerCase() === text.toLowerCase());
    return match
      ? { value: match }
      : { error: `“${option.key}” must be one of: ${option.choices.join(', ')}.` };
  },
  color(text, option) {
    const m = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return { error: `“${option.key}” must be a hex color like 2f5d8a.` };
    let hex = m[1].toLowerCase();
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    return { value: `#${hex}` };
  },
};

/** Parse one raw string. Empty input gives { value: undefined }. */
export function parseValue(option, raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: undefined };
  const parse = PARSERS[option.type];
  return parse ? parse(text, option) : { value: text };
}

/**
 * Parse a query string like location.search.
 * Returns `values` (defaults filled in), `errors` (messages), and `raw` (as typed, keyed by option).
 */
export function parseOptions(search) {
  const byName = new Map(OPTIONS.map((o) => [o.key.toLowerCase(), o]));
  const raw = {};
  for (const [name, value] of new URLSearchParams(search)) {
    const option = byName.get(name.toLowerCase());
    if (option && !(option.key in raw)) raw[option.key] = value;
  }
  const values = {};
  const errors = [];
  for (const option of OPTIONS) {
    const result = parseValue(option, raw[option.key]);
    if (result.error) errors.push(result.error);
    else if (result.value === undefined && option.required) {
      errors.push(`Missing “${option.key}”: add the ${option.label.toLowerCase()} to the embed link.`);
    }
    values[option.key] = result.value === undefined || result.error ? option.default : result.value;
  }
  return { values, errors, raw };
}

/** Build a query string from parsed values, leaving out anything at its default. */
export function buildQuery(values) {
  const pairs = [];
  for (const option of OPTIONS) {
    let value = values[option.key];
    if (value === undefined || value === '' || value === option.default) continue;
    if (option.type === 'color') value = String(value).replace('#', '');
    pairs.push(`${option.key}=${encodeURIComponent(value)}`);
  }
  return pairs.join('&');
}
