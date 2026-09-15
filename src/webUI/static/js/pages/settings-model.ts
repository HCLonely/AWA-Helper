/** Template definitions are immutable; drafts contain values and cached conditional branches. */
interface SettingsFieldBase {
  readonly name?: string;
  readonly desp?: string;
  readonly required?: boolean;
  readonly repeat?: boolean | number;
  readonly defaultValue?: unknown;
}
type SettingsFields = Readonly<Record<string, SettingsField>>;
type SettingsField = SettingsFieldBase & (
  { readonly type: 'text' | 'integer-array'; readonly inputType?: string; readonly placeholder?: string; readonly validation?: string } |
  { readonly type: 'boolean' } |
  { readonly type: 'single-select' | 'multi-select'; readonly options: readonly string[]; readonly optionsName?: readonly string[];
    readonly bindValue?: { readonly body: Readonly<Record<string, SettingsFields>>; readonly isChildren?: boolean } } |
  { readonly type: 'object'; readonly body: SettingsFields } |
  { readonly type: 'array'; readonly body: readonly SettingsField[] }
);
interface SettingsTemplate {
  readonly name: string;
  readonly type: 'yml' | 'yaml' | 'json';
  readonly body: SettingsFields;
  readonly quote?: string;
  readonly author?: string;
}
type SettingsData = Record<string, unknown>;
interface SettingsScope {
  base: SettingsData;
  fields: SettingsNode[];
}
interface SettingsNode {
  readonly id: string;
  readonly name: string;
  readonly schema: SettingsField;
  value: unknown;
  object?: SettingsScope;
  items: SettingsNode[];
  branches: Map<string, SettingsScope>;
}

const SettingsModel = (() => {
  let nextId = 0;
  const patterns = new WeakMap<SettingsField, RegExp>();
  const isRecord = (value: unknown): value is SettingsData => !!value && typeof value === 'object' && !Array.isArray(value);
  const record = (value: unknown): SettingsData => (isRecord(value) ? value : {});
  const own = (value: SettingsData, key: string): unknown => (Object.hasOwn(value, key) ? value[key] : undefined);
  function fail(path: string, message: string): never {
    throw new Error(`${path}: ${message}`);
  }

  function checkFields(value: unknown, path: string, depth: number): asserts value is SettingsFields {
    if (!isRecord(value)) {
      fail(path, SettingsI18n.t('Expected field definitions'));
    }
    for (const [key, field] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        fail(path, SettingsI18n.t('Unsupported field name'));
      }
      checkField(field, `${path}.${key}`, depth + 1);
    }
    const owners = new Set<string>();
    for (const [name, schema] of Object.entries(value as SettingsFields)) {
      const names = ownedNames({ [name]: schema });
      if (names.slice(1).includes(name)) {
        fail(path, SettingsI18n.t('Conditional field overrides its selector: %s', name));
      }
      for (const key of new Set(names)) {
        if (owners.has(key)) {
          fail(path, SettingsI18n.t('Conflicting conditional field: %s', key));
        }
        owners.add(key);
      }
    }
  }
  function checkField(value: unknown, path: string, depth: number): asserts value is SettingsField {
    if (depth > 50 || !isRecord(value)) {
      fail(path, SettingsI18n.t('Invalid or excessively nested field'));
    }
    for (const key of ['name', 'desp', 'placeholder', 'inputType', 'validation']) {
      if (value[key] !== undefined && typeof value[key] !== 'string') {
        fail(path, SettingsI18n.t('%s must be a string', key));
      }
    }
    if (value.required !== undefined && typeof value.required !== 'boolean') {
      fail(path, SettingsI18n.t('required must be boolean'));
    }
    if (value.repeat !== undefined && typeof value.repeat !== 'boolean' &&
      !(Number.isSafeInteger(value.repeat) && Number(value.repeat) > 0 && Number(value.repeat) <= 1000)) {
      fail(path, SettingsI18n.t('Invalid repeat count'));
    }
    switch (value.type) {
      case 'text':
      case 'integer-array':
        if (value.validation) {
          try {
            new RegExp(String(value.validation));
          } catch {
            fail(path, SettingsI18n.t('Invalid regular expression'));
          }
        }
        if (value.inputType && !['text', 'textarea', 'number', 'password', 'email', 'url', 'tel', 'search'].includes(String(value.inputType))) {
          fail(path, SettingsI18n.t('Unsupported input type'));
        }
        break;
      case 'boolean': break;
      case 'object': checkFields(value.body, path, depth); break;
      case 'array':
        if (!Array.isArray(value.body) || !value.body.length) {
          fail(path, SettingsI18n.t('Array needs an item definition'));
        }
        value.body.forEach((item, index) => checkField(item, `${path}[${index}]`, depth + 1));
        break;
      case 'single-select':
      case 'multi-select':
        if (!Array.isArray(value.options) || !value.options.length || value.options.some((item) => typeof item !== 'string')) {
          fail(path, SettingsI18n.t('Expected string options'));
        }
        if (value.optionsName !== undefined && (!Array.isArray(value.optionsName) || value.optionsName.some((item) => typeof item !== 'string'))) {
          fail(path, SettingsI18n.t('Expected string option labels'));
        }
        if (value.bindValue !== undefined) {
          if (value.type !== 'single-select' || !isRecord(value.bindValue) || !isRecord(value.bindValue.body)) {
            fail(path, SettingsI18n.t('Invalid conditional fields'));
          }
          for (const [key, fields] of Object.entries(value.bindValue.body)) {
            checkFields(fields, `${path}[${key}]`, depth + 1);
          }
        }
        break;
      default: fail(path, SettingsI18n.t('Unsupported field type: %s', String(value.type)));
    }
    checkDefault(value as unknown as SettingsField, value.defaultValue, path);
  }
  function checkDefault(schema: SettingsField, value: unknown, path: string, siblings: SettingsData = {}): void {
    if (value === undefined) {
      value = schema.defaultValue;
    }
    if (schema.type === 'single-select' && (value === undefined || value === null)) {
      [value] = schema.options;
    }
    if (value === undefined || value === null) {
      return;
    }
    switch (schema.type) {
      case 'object':
        if (!isRecord(value)) {
          fail(path, SettingsI18n.t('Expected object default'));
        }
        for (const [name, field] of Object.entries(schema.body)) {
          checkDefault(field, own(value, name), `${path}.${name}`, value);
        }
        break;
      case 'array': {
        if (!Array.isArray(value)) {
          fail(path, SettingsI18n.t('Expected array default'));
        }
        const definitions = expandItems(schema);
        const repeat = definitions.find((field) => field.repeat === true);
        value.forEach((item, index) => {
          const definition = definitions[index] ?? repeat;
          if (!definition) {
            fail(path, SettingsI18n.t('No definition for default array item'));
          }
          checkDefault(definition, item, `${path}[${index}]`);
        });
        break;
      }
      case 'boolean':
        if (typeof value !== 'boolean') {
          fail(path, SettingsI18n.t('Expected boolean default'));
        }
        break;
      case 'text':
        if (typeof value !== 'string' && typeof value !== 'number') {
          fail(path, SettingsI18n.t('Expected text or numeric default'));
        }
        if (schema.inputType === 'number' && String(value).trim() !== '' && !Number.isFinite(Number(value))) {
          fail(path, SettingsI18n.t('Expected finite numeric default'));
        }
        break;
      case 'integer-array': {
        if (typeof value !== 'string' && !Array.isArray(value)) {
          fail(path, SettingsI18n.t('Expected integer array or comma-separated default'));
        }
        const numbers = Array.isArray(value) ? value : value.split(',').filter((part) => part.trim() !== '').map(Number);
        if (!numbers.every(Number.isSafeInteger)) {
          fail(path, SettingsI18n.t('Expected integer array default'));
        }
        break;
      }
      case 'single-select':
        if (typeof value !== 'string' || !schema.options.includes(value)) {
          fail(path, SettingsI18n.t('Unsupported default option'));
        }
        if (schema.bindValue && Object.hasOwn(schema.bindValue.body, value)) {
          for (const [name, field] of Object.entries(schema.bindValue.body[value])) {
            checkDefault(field, own(siblings, name), `${path}.${name}`, siblings);
          }
        }
        break;
      case 'multi-select':
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !schema.options.includes(item))) {
          fail(path, SettingsI18n.t('Unsupported default options'));
        }
        break;
    }
  }
  function freeze<T>(value: T, seen = new WeakSet<object>()): T {
    if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value);
      Object.values(value).forEach((item) => freeze(item, seen));
      Object.freeze(value);
    }
    return value;
  }
  function parseTemplates(source: string): SettingsTemplate[] {
    let parsed: unknown;
    try {
      parsed = jsyaml.load(source);
    } catch {
      throw new Error(SettingsI18n.t('Invalid template YAML'));
    }
    if (!Array.isArray(parsed) || !parsed.length) {
      fail(SettingsI18n.t('Template'), SettingsI18n.t('Expected a non-empty array'));
    }
    return parsed.map((value, index) => {
      if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) {
        fail(SettingsI18n.t('Template %s', String(index)), SettingsI18n.t('Missing name'));
      }
      const type = String(value.type || String(value.filename || '').split('.').pop()).toLowerCase();
      // This page writes to the Manager YAML API; INI is not an accepted server format.
      if (type !== 'yml' && type !== 'yaml' && type !== 'json') {
        fail(value.name, SettingsI18n.t('Expected YAML or JSON format'));
      }
      checkFields(value.body, value.name, 0);
      return freeze({ name: value.name, type, body: value.body,
        quote: typeof value.quote === 'string' ? value.quote : undefined,
        author: typeof value.author === 'string' ? value.author : undefined });
    });
  }
  function expandItems(schema: Extract<SettingsField, { type: 'array' }>): SettingsField[] {
    return schema.body.flatMap((item) => Array.from({ length: typeof item.repeat === 'number' ? item.repeat : 1 }, () => item));
  }
  function ownedNames(fields: SettingsFields): string[] {
    return Object.entries(fields).flatMap(([name, schema]) => {
      if (schema.type === 'single-select' && schema.bindValue) {
        return [name, ...Object.values(schema.bindValue.body).flatMap(ownedNames)];
      }
      return [name];
    });
  }
  function createScope(fields: SettingsFields, config: SettingsData): SettingsScope {
    return { base: structuredClone(config), fields: Object.entries(fields).map(([name, schema]) => createNode(name, schema, own(config, name), config)) };
  }
  function createNode(name: string, schema: SettingsField, source?: unknown, siblings: SettingsData = {}): SettingsNode {
    const value = source === undefined ? schema.defaultValue : source;
    const node: SettingsNode = { id: `setting-${++nextId}`, name, schema, value, items: [], branches: new Map() };
    if (schema.type === 'object') {
      if (value !== undefined && value !== null && !isRecord(value)) {
        fail(name, SettingsI18n.t('Expected object configuration'));
      }
      node.object = createScope(schema.body, record(value));
    } else if (schema.type === 'array') {
      const definitions = expandItems(schema);
      const repeat = definitions.find((item) => item.repeat === true);
      let values: unknown[] = [];
      if (Array.isArray(value)) {
        values = value;
      } else if (value !== undefined && value !== null) {
        fail(name, SettingsI18n.t('Expected array configuration'));
      } else if (value === undefined && !repeat) {
        values = definitions.map((item) => item.defaultValue);
      }
      node.items = values.map((item, index) => {
        const definition = definitions[index] ?? repeat;
        if (!definition) {
          fail(name, SettingsI18n.t('No definition for array item'));
        }
        return createNode(String(index), definition, item);
      });
    } else if (schema.type === 'single-select') {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        fail(name, SettingsI18n.t('Expected selected option'));
      }
      node.value = value ?? schema.options[0];
      if (schema.bindValue) {
        const selected = String(node.value);
        const fields = schema.bindValue.body[selected];
        if (Object.hasOwn(schema.bindValue.body, selected)) {
          // Other branches are created on first use; only this branch owns persisted sibling values.
          const base = Object.fromEntries(ownedNames(fields).filter((field) => Object.hasOwn(siblings, field)).map((field) => [field, siblings[field]]));
          node.branches.set(selected, createScope(fields, base));
        }
      }
    } else if (schema.type === 'multi-select') {
      if (value !== undefined && value !== null && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
        fail(name, SettingsI18n.t('Expected selected options'));
      }
      node.value = value ?? [];
    } else if (schema.type === 'boolean') {
      if (value !== undefined && value !== null && typeof value !== 'boolean') {
        fail(name, SettingsI18n.t('Expected boolean configuration'));
      }
      node.value = value ?? false;
    } else {
      if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number' &&
        !(schema.type === 'integer-array' && Array.isArray(value))) {
        fail(name, SettingsI18n.t('Expected text or numeric configuration'));
      }
      node.value = value ?? '';
      if (schema.type === 'text' && schema.inputType === 'number') {
        const numeric = String(node.value).trim();
        if (numeric && !Number.isFinite(Number(numeric))) {
          fail(name, SettingsI18n.t('Expected finite numeric configuration'));
        }
        // Number inputs discard whitespace and non-decimal notation if assigned verbatim.
        node.value = numeric ? String(Number(numeric)) : '';
      }
      if (schema.type === 'integer-array' && Array.isArray(node.value)) {
        node.value = node.value.join(',');
      }
    }
    return node;
  }
  function activeBranch(node: SettingsNode): SettingsScope | undefined {
    const selected = String(node.value);
    if (!node.branches.has(selected) && node.schema.type === 'single-select' && node.schema.bindValue && Object.hasOwn(node.schema.bindValue.body, selected)) {
      node.branches.set(selected, createScope(node.schema.bindValue.body[selected], {}));
    }
    return node.branches.get(selected);
  }
  function walk(scope: SettingsScope, visit: (node: SettingsNode) => void): void {
    const visitNode = (node: SettingsNode): void => {
      visit(node);
      if (node.object) {
        walk(node.object, visit);
      }
      node.items.forEach(visitNode);
      const branch = activeBranch(node);
      if (branch) {
        walk(branch, visit);
      }
    };
    scope.fields.forEach(visitNode);
  }
  function scalar(node: SettingsNode): unknown {
    const { schema, value } = node;
    if (schema.type === 'integer-array') {
      return String(value).split(',').map((part) => part.trim())
        .filter(Boolean)
        .map(Number);
    }
    if (schema.type === 'text' && schema.inputType === 'number') {
      return String(value).trim() === '' ? null : Number(value);
    }
    return value;
  }
  function validate(node: SettingsNode): string {
    const { schema, value } = node;
    if (schema.type === 'array') {
      return schema.required && !node.items.length ? SettingsI18n.t('At least one item is required') : '';
    }
    if (schema.type === 'object') {
      return '';
    }
    if (schema.required && (value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length))) {
      return SettingsI18n.t('Required');
    }
    if (schema.type === 'integer-array') {
      const numbers = scalar(node) as number[];
      if (schema.required && !numbers.length) {
        return SettingsI18n.t('Required');
      }
      if (!numbers.every(Number.isSafeInteger)) {
        return SettingsI18n.t('Expected comma-separated integers');
      }
    }
    if (schema.type === 'text' && schema.inputType === 'number' && String(value).trim() !== '' && !Number.isFinite(Number(value))) {
      return SettingsI18n.t('Expected a finite number');
    }
    if ((schema.type === 'text' || schema.type === 'integer-array') && schema.validation) {
      let pattern = patterns.get(schema);
      if (!pattern) {
        pattern = new RegExp(schema.validation);
        patterns.set(schema, pattern);
      }
      if (!pattern.test(String(value))) {
        return SettingsI18n.t('Invalid format');
      }
    }
    if (schema.type === 'single-select' && !schema.options.includes(String(value))) {
      return SettingsI18n.t('Select a supported option');
    }
    if (schema.type === 'multi-select' && (!Array.isArray(value) || value.some((item) => !schema.options.includes(String(item))))) {
      return SettingsI18n.t('Select supported options');
    }
    return '';
  }
  function serializeNode(node: SettingsNode, baseline?: unknown): unknown {
    if (node.object) {
      return serialize(node.object, isRecord(baseline) ? baseline : node.object.base);
    }
    if (node.schema.type === 'array') {
      return node.items.map((item) => serializeNode(item));
    }
    return scalar(node);
  }
  function serialize(scope: SettingsScope, baseline = scope.base): SettingsData {
    const result = { ...baseline };
    for (const node of scope.fields) {
      // Drop fields owned by inactive branches, preserving unrelated extension keys.
      if (node.schema.type === 'single-select' && node.schema.bindValue) {
        for (const fields of Object.values(node.schema.bindValue.body)) {
          for (const name of ownedNames(fields)) {
            delete result[name];
          }
        }
      }
      Object.defineProperty(result, node.name, { value: serializeNode(node, baseline[node.name]), enumerable: true, writable: true, configurable: true });
      const branch = activeBranch(node);
      if (branch) {
        Object.assign(result, serialize(branch));
      }
    }
    return result;
  }
  function equalValue(left: unknown, right: unknown, seen = new WeakMap<object, WeakSet<object>>()): boolean {
    if (Object.is(left, right)) {
      return true;
    }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
      return false;
    }
    if (left instanceof Date || right instanceof Date) {
      return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
    }
    if (Array.isArray(left) !== Array.isArray(right)) {
      return false;
    }
    if (seen.get(left)?.has(right)) {
      return true;
    }
    const pairs = seen.get(left) ?? new WeakSet<object>();
    pairs.add(right);
    seen.set(left, pairs);
    const a = left as SettingsData;
    const b = right as SettingsData;
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.hasOwn(b, key) && equalValue(a[key], b[key], seen));
  }
  /** A stale form must not overwrite fields successfully saved by another form in this page. */
  function assertCompatible(scope: SettingsScope, original: SettingsData, latest: SettingsData, edited: SettingsData, path = ''): void {
    if (original === latest) {
      return;
    }
    for (const node of scope.fields) {
      const name = path ? `${path}.${node.name}` : node.name;
      const before = own(original, node.name);
      const current = own(latest, node.name);
      const proposed = own(edited, node.name);
      if (node.object && (current === undefined || isRecord(current)) && !(isRecord(before) && current === undefined)) {
        assertCompatible(node.object, record(before), record(current), record(proposed), name);
        continue;
      }
      // A selector and its dependent fields are one unit, even if branches reuse field names.
      const names = node.schema.type === 'single-select' && node.schema.bindValue
        ? [node.name, ...Object.values(node.schema.bindValue.body).flatMap(ownedNames)] : [node.name];
      const changed = names.some((key) => !equalValue(own(original, key), own(latest, key)));
      const matches = names.every((key) => equalValue(own(edited, key), own(latest, key)));
      if (changed && !matches) {
        fail(name, SettingsI18n.t('Changed in another form. Reload this page before saving, or enter the latest values.'));
      }
    }
  }
  function addItem(node: SettingsNode, after?: SettingsNode): SettingsNode {
    if (node.schema.type !== 'array') {
      throw new Error(SettingsI18n.t('Expected array'));
    }
    if (after && (!node.items.includes(after) || after.schema.repeat !== true)) {
      throw new Error(SettingsI18n.t('Cannot extend this array item'));
    }
    const schema = after?.schema ?? node.schema.body.find((item) => item.repeat === true);
    if (!schema) {
      throw new Error(SettingsI18n.t('Array cannot be extended'));
    }
    const item = createNode('', schema);
    const index = after ? node.items.indexOf(after) + 1 : node.items.length;
    node.items.splice(index, 0, item);
    return item;
  }
  function removeItem(node: SettingsNode, item: SettingsNode): void {
    const index = node.items.indexOf(item);
    if (node.schema.type !== 'array' || index < 0 || item.schema.repeat !== true) {
      throw new Error(SettingsI18n.t('Cannot remove this array item'));
    }
    node.items.splice(index, 1);
  }
  return { isRecord, parseTemplates, createScope, activeBranch, walk, scalar, validate, serialize, assertCompatible, addItem, removeItem };
})();
Object.assign(globalThis, { SettingsModel });

