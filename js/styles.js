// Shared style vocabulary and validation.
//
// The builder edits this data through style-editor.js. The embed only needs
// parseStyles() and applyStyles(), so new style targets and properties can be
// added without coupling the two sides together.

export const STYLE_VERSION = 1;

export const DIMENSION_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh'];
const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'none'];
const FONT_FAMILIES = [
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'monospace', label: 'Monospace' },
];

export const STYLE_TARGETS = [
  { key: 'card', label: 'Card', description: 'The outer item card.' },
  { key: 'image', label: 'Image', description: 'The image area and its placeholder.' },
  { key: 'body', label: 'Card body', description: 'The content area below the image.' },
  { key: 'title', label: 'Title', description: 'The card title text.' },
  { key: 'description', label: 'Description', description: 'The card description text.' },
  // Internal target used for properties that belong on the image itself.
  { key: 'imageContent', label: 'Image content', visible: false },
];

function dimension(value = 0, unit = 'px') {
  return { value, unit };
}

function spacing(value = 0, unit = 'px') {
  return { top: value, right: value, bottom: value, left: value, unit };
}

export const STYLE_PROPERTIES = [
  {
    key: 'backgroundColor', label: 'Background color', category: 'Color', editor: 'color', css: 'background-color',
    targets: ['card', 'image', 'body', 'title', 'description'], defaultValue: '#ffffff',
  },
  {
    key: 'color', label: 'Font color', category: 'Color', editor: 'color', css: 'color',
    targets: ['card', 'body', 'title', 'description'], defaultValue: '#1d232b',
  },
  {
    key: 'fontFamily', label: 'Font', category: 'Typography', editor: 'select', choices: FONT_FAMILIES,
    css: 'font-family', targets: ['card', 'body', 'title', 'description'], defaultValue: FONT_FAMILIES[0].value,
  },
  {
    key: 'fontSize', label: 'Font size', category: 'Typography', editor: 'dimension', css: 'font-size',
    targets: ['card', 'body', 'title', 'description'], defaultValue: dimension(16), min: 1, max: 200,
  },
  {
    key: 'fontWeight', label: 'Font weight', category: 'Typography', editor: 'select',
    choices: [
      { value: '400', label: 'Normal' }, { value: '500', label: 'Medium' },
      { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
    ],
    css: 'font-weight', targets: ['card', 'body', 'title', 'description'], defaultValue: '400',
  },
  {
    key: 'lineHeight', label: 'Line height', category: 'Typography', editor: 'number', css: 'line-height',
    targets: ['card', 'body', 'title', 'description'], defaultValue: 1.5, min: 0.8, max: 4, step: 0.1,
  },
  {
    key: 'letterSpacing', label: 'Letter spacing', category: 'Typography', editor: 'dimension', css: 'letter-spacing',
    targets: ['card', 'body', 'title', 'description'], defaultValue: dimension(0), min: -20, max: 50,
  },
  {
    key: 'textAlign', label: 'Text alignment', category: 'Typography', editor: 'select',
    choices: [
      { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' }, { value: 'justify', label: 'Justify' },
    ],
    css: 'text-align', targets: ['card', 'body', 'title', 'description'], defaultValue: 'left',
  },
  {
    key: 'padding', label: 'Padding', category: 'Spacing', editor: 'spacing', css: 'padding',
    targets: ['card', 'body', 'title', 'description'], defaultValue: spacing(), min: 0, max: 200,
  },
  {
    key: 'margin', label: 'Margin', category: 'Spacing', editor: 'spacing', css: 'margin',
    targets: ['body', 'title', 'description'], defaultValue: spacing(), min: 0, max: 200,
  },
  {
    key: 'gap', label: 'Gap', category: 'Spacing', editor: 'dimension', css: 'gap',
    targets: ['card', 'body'], defaultValue: dimension(4), min: 0, max: 200,
  },
  {
    key: 'border', label: 'Border', category: 'Surface', editor: 'border', css: 'border',
    targets: ['card', 'image', 'body'], defaultValue: { width: dimension(1), style: 'solid', color: '#d3d9e0' },
  },
  {
    key: 'borderRadius', label: 'Border radius', category: 'Surface', editor: 'dimension', css: 'border-radius',
    targets: ['card', 'image', 'body'], defaultValue: dimension(10), min: 0, max: 200,
  },
  {
    key: 'boxShadow', label: 'Drop shadow', category: 'Surface', editor: 'shadow', css: 'box-shadow',
    targets: ['card', 'image', 'body'],
    defaultValue: { x: 0, y: 4, blur: 12, spread: 0, unit: 'px', color: '#000000', opacity: 0.15, inset: false },
  },
  {
    key: 'opacity', label: 'Opacity', category: 'Surface', editor: 'range', css: 'opacity',
    targets: ['card', 'image', 'body', 'title', 'description'], defaultValue: 1, min: 0, max: 1, step: 0.05,
  },
  {
    key: 'objectFit', label: 'Image fit', category: 'Image', editor: 'select', css: 'object-fit',
    targets: ['image'], applyTo: 'imageContent',
    choices: [
      { value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' },
      { value: 'fill', label: 'Stretch' }, { value: 'none', label: 'Original size' },
    ],
    defaultValue: 'cover',
  },
];

const targetByKey = new Map(STYLE_TARGETS.map((target) => [target.key, target]));
const propertyByKey = new Map(STYLE_PROPERTIES.map((property) => [property.key, property]));

function clone(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
}

function error(property, message) {
  return { error: `${property.label}: ${message}` };
}

function parseColor(property, value) {
  const match = String(value ?? '').match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return error(property, 'must be a hex color.');
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((char) => char + char).join('');
  return { value: `#${hex}` };
}

function parseNumber(property, value, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max)
    return error(property, `must be a number from ${min} to ${max}.`);
  return { value: number };
}

function parseDimension(property, value, { min = -Infinity, max = Infinity } = {}) {
  const source = typeof value === 'string' ? value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)$/) : value;
  if (typeof source === 'object' && source && !Array.isArray(source) && 'value' in source) {
    if (!DIMENSION_UNITS.includes(source.unit)) return error(property, 'has an unsupported unit.');
    const number = Number(source.value);
    if (!Number.isFinite(number) || number < min || number > max) return error(property, 'has an invalid size.');
    return { value: { value: number, unit: source.unit } };
  }
  if (!source) return error(property, 'must be a size with a supported unit.');
  const number = Number(source[1]);
  if (number < min || number > max) return error(property, 'has an invalid size.');
  return { value: { value: number, unit: source[2] } };
}

function parseSpacing(property, value, bounds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return error(property, 'must contain four sides.');
  if (!DIMENSION_UNITS.includes(value.unit)) return error(property, 'has an unsupported unit.');
  const result = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const parsed = parseNumber(property, value[side], bounds);
    if (parsed.error) return parsed;
    result[side] = parsed.value;
  }
  return { value: { ...result, unit: value.unit } };
}

function parseBorder(property, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return error(property, 'must contain width, style, and color.');
  const width = parseDimension(property, value.width, { min: 0, max: 50 });
  if (width.error) return width;
  if (!BORDER_STYLES.includes(value.style)) return error(property, 'has an unsupported border style.');
  const color = parseColor(property, value.color);
  if (color.error) return color;
  return { value: { width: width.value, style: value.style, color: color.value } };
}

function parseShadow(property, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return error(property, 'must contain shadow offsets and color.');
  if (!DIMENSION_UNITS.includes(value.unit)) return error(property, 'has an unsupported unit.');
  const result = {};
  for (const side of ['x', 'y', 'blur', 'spread']) {
    const parsed = parseNumber(property, value[side], { min: side === 'blur' || side === 'spread' ? 0 : -200, max: 200 });
    if (parsed.error) return parsed;
    result[side] = parsed.value;
  }
  const color = parseColor(property, value.color);
  if (color.error) return color;
  const opacity = parseNumber(property, value.opacity, { min: 0, max: 1 });
  if (opacity.error) return opacity;
  return { value: { ...result, unit: value.unit, color: color.value, opacity: opacity.value, inset: Boolean(value.inset) } };
}

export function parseStyleValue(property, value) {
  if (!propertyByKey.has(property.key)) return error(property, 'is not registered.');
  switch (property.editor) {
    case 'color': return parseColor(property, value);
    case 'dimension': return parseDimension(property, value, { min: property.min, max: property.max });
    case 'number': return parseNumber(property, value, { min: property.min, max: property.max });
    case 'range': return parseNumber(property, value, { min: property.min, max: property.max });
    case 'spacing': return parseSpacing(property, value, { min: property.min, max: property.max });
    case 'border': return parseBorder(property, value);
    case 'shadow': return parseShadow(property, value);
    case 'select':
      return property.choices.some((choice) => choice.value === value)
        ? { value }
        : error(property, 'has an unsupported value.');
    default:
      return error(property, 'uses an unsupported editor.');
  }
}

export function emptyStyles() {
  return { version: STYLE_VERSION, targets: {} };
}

/** Parse and normalize the serialized style configuration. */
export function parseStyles(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: undefined };
  let source;
  try {
    source = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { error: 'Styles must be valid configuration data.' };
  }
  if (!source || typeof source !== 'object' || Array.isArray(source))
    return { error: 'Styles must be an object.' };
  if (source.version !== undefined && source.version !== STYLE_VERSION)
    return { error: `Styles use an unsupported version (${source.version}).` };
  if (!source.targets || typeof source.targets !== 'object' || Array.isArray(source.targets))
    return { error: 'Styles must contain target elements.' };

  const normalized = emptyStyles();
  for (const [targetKey, properties] of Object.entries(source.targets)) {
    const target = targetByKey.get(targetKey);
    if (!target || target.visible === false) return { error: `Styles contain an unknown target “${targetKey}”.` };
    if (!properties || typeof properties !== 'object' || Array.isArray(properties))
      return { error: `Styles for ${target.label} must be an object.` };
    for (const [propertyKey, value] of Object.entries(properties)) {
      const property = propertyByKey.get(propertyKey);
      if (!property || !property.targets.includes(targetKey))
        return { error: `“${propertyKey}” cannot be used on ${target.label}.` };
      const parsed = parseStyleValue(property, value);
      if (parsed.error) return { error: parsed.error };
      normalized.targets[targetKey] ??= {};
      normalized.targets[targetKey][propertyKey] = parsed.value;
    }
  }
  return Object.keys(normalized.targets).length ? { value: normalized } : { value: undefined };
}

export function serializeStyles(styles) {
  const parsed = parseStyles(styles);
  return parsed.value ? JSON.stringify(parsed.value) : '';
}

function cssDimension(value, fallbackUnit = 'px') {
  return `${value}${fallbackUnit}`;
}

function rgba(hex, opacity) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value;
  const channels = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return `rgba(${channels.join(', ')}, ${opacity})`;
}

export function styleValueToCss(property, value) {
  switch (property.editor) {
    case 'dimension': return cssDimension(value.value, value.unit);
    case 'spacing': return ['top', 'right', 'bottom', 'left'].map((side) => cssDimension(value[side], value.unit)).join(' ');
    case 'border': return `${cssDimension(value.width.value, value.width.unit)} ${value.style} ${value.color}`;
    case 'shadow': return `${value.inset ? 'inset ' : ''}${cssDimension(value.x, value.unit)} ${cssDimension(value.y, value.unit)} ${cssDimension(value.blur, value.unit)} ${cssDimension(value.spread, value.unit)} ${rgba(value.color, value.opacity)}`;
    default: return String(value);
  }
}

/** Apply one registered target's styles to a DOM node. */
export function applyStyles(node, targetKey, styles, sourceTarget = targetKey) {
  if (!node || !styles?.targets?.[sourceTarget]) return;
  for (const [propertyKey, value] of Object.entries(styles.targets[sourceTarget])) {
    const property = propertyByKey.get(propertyKey);
    if (!property || !property.targets.includes(sourceTarget)) continue;
    if ((property.applyTo ?? sourceTarget) !== targetKey) continue;
    const parsed = parseStyleValue(property, value);
    if (parsed.error) continue;
    node.style.setProperty(property.css, styleValueToCss(property, parsed.value));
  }
}

export function getStyleProperty(key) {
  return propertyByKey.get(key);
}

export function getStyleTarget(key) {
  return targetByKey.get(key);
}

export function cloneStyleValue(value) {
  return clone(value);
}
