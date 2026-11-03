// The builder-side editor for the shared style schema.

import {
  DIMENSION_UNITS,
} from './styles.js';
import {
  STYLE_PROPERTIES,
  STYLE_TARGETS,
  cloneStyleValue,
  emptyStyles,
  parseStyles,
  serializeStyles,
} from './styles.js';
import { el } from './util.js';

const sides = [
  ['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left'],
];

function fieldLabel(text, control) {
  return el('label', { class: 'style-subfield' }, el('span', { text }), control);
}

function numberInput(value, { min, max, step = 'any', ariaLabel }) {
  return el('input', {
    type: 'number', value, min, max, step, inputmode: 'decimal', 'aria-label': ariaLabel,
  });
}

function createColorEditor(value, onChange, ariaLabel) {
  const picker = el('input', { type: 'color', value, 'aria-label': ariaLabel });
  const output = el('output', { class: 'style-color-value', text: value });
  picker.addEventListener('input', () => {
    output.textContent = picker.value;
    onChange(picker.value);
  });
  return el('div', { class: 'style-color-editor' }, picker, output);
}

function createSelectEditor(property, value, onChange) {
  const select = el(
    'select',
    { 'aria-label': property.label },
    property.choices.map((choice) => el('option', { value: choice.value, text: choice.label }))
  );
  select.value = value;
  select.addEventListener('input', () => onChange(select.value));
  return select;
}

function createNumberEditor(property, value, onChange) {
  const input = numberInput(value, {
    min: property.min,
    max: property.max,
    step: property.step ?? 'any',
    ariaLabel: property.label,
  });
  input.addEventListener('input', () => onChange(Number(input.value || 0)));
  return input;
}

function createRangeEditor(property, value, onChange) {
  const input = el('input', {
    type: 'range', value, min: property.min, max: property.max, step: property.step,
    'aria-label': property.label,
  });
  const output = el('output', { class: 'style-range-value', text: Number(value).toFixed(2) });
  input.addEventListener('input', () => {
    const number = Number(input.value);
    output.textContent = number.toFixed(2);
    onChange(number);
  });
  return el('div', { class: 'style-range-editor' }, input, output);
}

function createDimensionEditor(property, value, onChange) {
  const current = cloneStyleValue(value);
  const number = numberInput(current.value, {
    min: property.min,
    max: property.max,
    step: property.step ?? 'any',
    ariaLabel: `${property.label} value`,
  });
  const unit = el(
    'select',
    { 'aria-label': `${property.label} unit` },
    DIMENSION_UNITS.map((choice) => el('option', { value: choice, text: choice }))
  );
  unit.value = current.unit;
  const emit = () => onChange({ value: Number(number.value || 0), unit: unit.value });
  number.addEventListener('input', emit);
  unit.addEventListener('input', emit);
  return el('div', { class: 'style-dimension-editor' }, number, unit);
}

function createSpacingEditor(property, value, onChange) {
  const current = cloneStyleValue(value);
  const fields = {};
  const emit = () => onChange({
    top: Number(fields.top.value || 0),
    right: Number(fields.right.value || 0),
    bottom: Number(fields.bottom.value || 0),
    left: Number(fields.left.value || 0),
    unit: unit.value,
  });
  for (const [key, label] of sides) {
    fields[key] = numberInput(current[key], {
      min: property.min,
      max: property.max,
      step: 'any',
      ariaLabel: `${property.label}, ${label}`,
    });
    fields[key].addEventListener('input', emit);
  }
  const unit = el(
    'select',
    { 'aria-label': `${property.label} unit` },
    DIMENSION_UNITS.map((choice) => el('option', { value: choice, text: choice }))
  );
  unit.value = current.unit;
  unit.addEventListener('input', emit);
  return el(
    'div',
    { class: 'style-spacing-editor' },
    el('div', { class: 'style-spacing-fields' }, sides.map(([key, label]) => fieldLabel(label, fields[key]))),
    fieldLabel('Unit', unit)
  );
}

function createBorderEditor(property, value, onChange) {
  const current = cloneStyleValue(value);
  const update = (key, next) => {
    current[key] = next;
    onChange(cloneStyleValue(current));
  };
  const width = createDimensionEditor(
    { ...property, label: 'Border width', min: 0, max: 50 },
    current.width,
    (next) => update('width', next)
  );
  const style = el(
    'select',
    { 'aria-label': 'Border style' },
    [
      ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'],
      ['double', 'Double'], ['none', 'None'],
    ].map(([value, label]) => el('option', { value, text: label }))
  );
  style.value = current.style;
  style.addEventListener('input', () => update('style', style.value));
  const color = createColorEditor(current.color, (next) => update('color', next), 'Border color');
  return el(
    'div',
    { class: 'style-border-editor' },
    fieldLabel('Width', width),
    fieldLabel('Style', style),
    fieldLabel('Color', color)
  );
}

function createShadowEditor(property, value, onChange) {
  const current = cloneStyleValue(value);
  const fields = {};
  const emit = () => onChange({
    x: Number(fields.x.value || 0),
    y: Number(fields.y.value || 0),
    blur: Number(fields.blur.value || 0),
    spread: Number(fields.spread.value || 0),
    unit: unit.value,
    color: current.color,
    opacity: Number(opacity.value),
    inset: inset.checked,
  });
  for (const [key, label, min] of [
    ['x', 'X offset', -200], ['y', 'Y offset', -200], ['blur', 'Blur', 0], ['spread', 'Spread', 0],
  ]) {
    fields[key] = numberInput(current[key], { min, max: 200, step: 'any', ariaLabel: label });
    fields[key].addEventListener('input', emit);
  }
  const unit = el(
    'select',
    { 'aria-label': 'Shadow unit' },
    DIMENSION_UNITS.map((choice) => el('option', { value: choice, text: choice }))
  );
  unit.value = current.unit;
  unit.addEventListener('input', emit);
  const color = createColorEditor(current.color, (next) => { current.color = next; emit(); }, 'Shadow color');
  const opacity = el('input', {
    type: 'range', value: current.opacity, min: 0, max: 1, step: 0.05, 'aria-label': 'Shadow opacity',
  });
  const opacityOutput = el('output', { class: 'style-range-value', text: Number(current.opacity).toFixed(2) });
  opacity.addEventListener('input', () => {
    opacityOutput.textContent = Number(opacity.value).toFixed(2);
    emit();
  });
  const inset = el('input', { type: 'checkbox', checked: current.inset, 'aria-label': 'Inset shadow' });
  inset.addEventListener('input', emit);
  return el(
    'div',
    { class: 'style-shadow-editor' },
    el('div', { class: 'style-shadow-fields' },
      fieldLabel('X', fields.x), fieldLabel('Y', fields.y),
      fieldLabel('Blur', fields.blur), fieldLabel('Spread', fields.spread),
      fieldLabel('Unit', unit)),
    fieldLabel('Color', color),
    fieldLabel('Opacity', el('div', { class: 'style-range-editor' }, opacity, opacityOutput)),
    el('label', { class: 'style-check' }, inset, el('span', { text: 'Inset shadow' }))
  );
}

function createValueEditor(property, value, onChange) {
  switch (property.editor) {
    case 'color': return createColorEditor(value, onChange, property.label);
    case 'select': return createSelectEditor(property, value, onChange);
    case 'number': return createNumberEditor(property, value, onChange);
    case 'range': return createRangeEditor(property, value, onChange);
    case 'dimension': return createDimensionEditor(property, value, onChange);
    case 'spacing': return createSpacingEditor(property, value, onChange);
    case 'border': return createBorderEditor(property, value, onChange);
    case 'shadow': return createShadowEditor(property, value, onChange);
    default: throw new Error(`Unknown style editor: ${property.editor}`);
  }
}

export function createStyleControl(option, { onChange = () => {} } = {}) {
  let styles = emptyStyles();
  let invalidRaw = '';
  const expanded = new Set();
  const root = el('div', { id: `opt-${option.key}`, class: 'style-editor' });

  function notify() {
    invalidRaw = '';
    onChange();
  }

  function addProperty(targetKey, propertyKey) {
    const property = STYLE_PROPERTIES.find((candidate) => candidate.key === propertyKey);
    if (!property) return;
    styles.targets[targetKey] ??= {};
    styles.targets[targetKey][property.key] = cloneStyleValue(property.defaultValue);
    expanded.add(`${targetKey}.${property.key}`);
    render();
    notify();
  }

  function removeProperty(targetKey, propertyKey) {
    const target = styles.targets[targetKey];
    if (!target) return;
    delete target[propertyKey];
    if (!Object.keys(target).length) delete styles.targets[targetKey];
    expanded.delete(`${targetKey}.${propertyKey}`);
    render();
    notify();
  }

  function focusProperty(targetKey, propertyKey) {
    const property = STYLE_PROPERTIES.find((candidate) => candidate.key === propertyKey);
    if (!property || !property.targets.includes(targetKey)) return false;
    styles.targets[targetKey] ??= {};
    if (!(propertyKey in styles.targets[targetKey]))
      styles.targets[targetKey][propertyKey] = cloneStyleValue(property.defaultValue);
    expanded.add(`${targetKey}.${propertyKey}`);
    render();
    notify();
    const row = root.querySelector(`[data-style-target="${targetKey}"][data-style-property="${propertyKey}"]`);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row?.querySelector('input, select, button')?.focus();
    return true;
  }

  function propertyRow(targetKey, property, value) {
    const row = el('details', {
      class: 'style-property-row',
      'data-style-target': targetKey,
      'data-style-property': property.key,
      open: expanded.has(`${targetKey}.${property.key}`),
    });
    const remove = el('button', {
      type: 'button', class: 'style-remove', 'aria-label': `Remove ${property.label}`,
      text: 'Remove',
    });
    remove.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeProperty(targetKey, property.key);
    });
    row.addEventListener('toggle', () => {
      const key = `${targetKey}.${property.key}`;
      if (row.open) expanded.add(key);
      else expanded.delete(key);
    });
    const updateValue = (next) => {
      styles.targets[targetKey][property.key] = cloneStyleValue(next);
      notify();
    };
    row.append(
      el('summary', { class: 'style-property-summary' }, el('span', { class: 'style-property-label', text: property.label }), remove),
      el('div', { class: 'style-property-content' }, createValueEditor(property, value, updateValue))
    );
    return row;
  }

  function targetPanel(target) {
    const configured = styles.targets[target.key] || {};
    const used = new Set(Object.keys(configured));
    const choices = STYLE_PROPERTIES
      .filter((property) => property.targets.includes(target.key) && !used.has(property.key))
      .sort((a, b) => `${a.category}:${a.label}`.localeCompare(`${b.category}:${b.label}`));
    const select = el('select', { 'aria-label': `Style to add to ${target.label}` });
    select.append(el('option', { value: '', text: 'Add a style…' }));
    for (const property of choices) select.append(el('option', { value: property.key, text: `${property.category}: ${property.label}` }));
    const add = el('button', { type: 'button', class: 'style-add', text: 'Add' });
    add.disabled = !choices.length;
    add.addEventListener('click', () => {
      if (select.value) addProperty(target.key, select.value);
    });
    const rows = Object.entries(configured).map(([key, value]) => {
      const property = STYLE_PROPERTIES.find((candidate) => candidate.key === key);
      return property ? propertyRow(target.key, property, value) : null;
    }).filter(Boolean);
    return el(
      'section',
      { class: 'style-target' },
      el('div', { class: 'style-target-heading' },
        el('div', {}, el('h3', { text: target.label }), target.description && el('p', { class: 'help', text: target.description })),
        el('div', { class: 'style-add-row' }, select, add)),
      rows.length ? rows : el('p', { class: 'style-empty', text: 'No styles added.' })
    );
  }

  function render() {
    root.replaceChildren(
      el('p', { class: 'style-editor-intro', text: 'Add only the style attributes you want to override.' }),
      ...STYLE_TARGETS.filter((target) => target.visible !== false).map(targetPanel)
    );
  }

  render();
  return {
    node: root,
    get: () => invalidRaw || serializeStyles(styles),
    set: (value) => {
      const parsed = parseStyles(value);
      invalidRaw = parsed.error ? String(value ?? '') : '';
      styles = parsed.value ?? emptyStyles();
      expanded.clear();
      render();
    },
    focusProperty,
    onChange,
  };
}
