/** Renders drafts with DOM properties. Delegated events also cover newly added fields. */
const SettingsView = (() => {
  type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  type Action = () => void;
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const result = document.createElement(tag);
    result.className = className;
    result.textContent = text;
    return result;
  }
  function button(text: string, className = 'btn btn-outline-primary'): HTMLButtonElement {
    const result = element('button', className, text);
    result.type = 'button';
    return result;
  }
  function render(form: HTMLFormElement, scope: SettingsScope): { validate: () => boolean; sync: () => void } {
    const controls = new WeakMap<SettingsNode, Control>();
    const nodes = new WeakMap<Element, SettingsNode>();
    const actions = new WeakMap<Element, Action>();
    const branchViews = new WeakMap<SettingsNode, { container: HTMLElement; parentPath: string }>();
    const groups = new WeakMap<SettingsNode, HTMLElement>();
    const feedbacks = new WeakMap<SettingsNode, HTMLElement>();
    const collapsed = new WeakSet<SettingsNode>();
    const collapseNodes = new WeakMap<HTMLElement, SettingsNode>();

    function read(node: SettingsNode, control: Control): void {
      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        node.value = control.checked;
      } else if (control instanceof HTMLSelectElement && control.multiple) {
        node.value = Array.from(control.selectedOptions, (option) => option.value);
      } else {
        node.value = control.value;
      }
    }
    const sync = (current = scope): void => SettingsModel.walk(current, (node) => {
      const control = controls.get(node);
      if (control) {
        capture(node, control);
      }
    });
    function capture(node: SettingsNode, control: Control): void {
      const previous = node.value;
      const previousBranch = node.branches.get(String(previous));
      read(node, control);
      if (node.schema.type === 'single-select' && node.schema.bindValue && previous !== node.value) {
        // Read autofilled values before detaching the old branch's controls.
        if (previousBranch) {
          sync(previousBranch);
        }
        renderBranch(node);
      }
    }
    function renderScope(parent: HTMLElement, current: SettingsScope, path: string): void {
      const fragment = document.createDocumentFragment();
      current.fields.forEach((node) => fragment.append(renderNode(node, path ? `${path}.${node.name}` : node.name, path)));
      parent.replaceChildren(fragment);
    }
    function renderBranch(node: SettingsNode): void {
      const view = branchViews.get(node);
      if (!view) {
        return;
      }
      const branch = SettingsModel.activeBranch(node);
      if (branch) {
        renderScope(view.container, branch, view.parentPath);
      } else {
        view.container.replaceChildren();
      }
    }
    function renderArray(parent: HTMLElement, node: SettingsNode, path: string): void {
      const fragment = document.createDocumentFragment();
      const repeatable = node.schema.type === 'array' && node.schema.body.some((item) => item.repeat === true);
      const append = repeatable ? button('+', 'btn btn-outline-primary repeat') : undefined;
      const updateFeedback = (): void => {
        const feedback = feedbacks.get(node);
        if (feedback) {
          const error = SettingsModel.validate(node);
          feedback.textContent = error;
          feedback.style.display = error ? 'block' : 'none';
        }
      };
      const insert = (after?: SettingsNode, before: ChildNode | null = append ?? null): void => {
        const item = SettingsModel.addItem(node, after);
        parent.insertBefore(renderItem(item), before);
        updateFeedback();
      };
      const renderItem = (item: SettingsNode): HTMLElement => {
        const row = renderNode(item, `${path}.${item.id}`, path);
        if (item.schema.repeat === true) {
          const toolbar = element('div', 'mb-3 settings-array-actions');
          const add = button('+', 'btn btn-outline-primary repeat');
          const remove = button('−', 'btn btn-outline-primary delete-repeat');
          add.setAttribute('aria-label', SettingsI18n.t('Add %s', SettingsI18n.t(item.schema.name || node.name)));
          remove.setAttribute('aria-label', SettingsI18n.t('Delete %s', SettingsI18n.t(item.schema.name || node.name)));
          actions.set(add, () => insert(item, row.nextSibling));
          actions.set(remove, () => {
            SettingsModel.removeItem(node, item);
            row.remove();
            updateFeedback();
          });
          toolbar.append(remove, add);
          row.append(toolbar);
        }
        return row;
      };
      node.items.forEach((item) => fragment.append(renderItem(item)));
      if (append) {
        append.setAttribute('aria-label', SettingsI18n.t('Add %s', SettingsI18n.t(node.schema.name || node.name)));
        actions.set(append, () => insert());
        fragment.append(append);
      }
      parent.replaceChildren(fragment);
    }
    function renderNode(node: SettingsNode, path: string, parentPath: string): HTMLElement {
      const { schema } = node;
      const wrapper = element('div', 'mb-3 settings-field');
      wrapper.dataset.fieldPath = path;
      const title = `${SettingsI18n.t(schema.name || node.name || 'Item')}${schema.required ? ' *' : ''}`;
      if (schema.type === 'object' || schema.type === 'array') {
        wrapper.classList.add('card', 'card-body', 'settings-group');
        const toggle = button(title, 'btn btn-primary settings-group-toggle');
        const children = element('div', collapsed.has(node) ? 'collapse' : 'collapse show');
        children.id = node.id;
        collapseNodes.set(children, node);
        toggle.setAttribute('aria-controls', node.id);
        toggle.setAttribute('aria-expanded', String(!collapsed.has(node)));
        actions.set(toggle, () => {
          const open = children.classList.toggle('show');
          if (open) {
            collapsed.delete(node);
          } else {
            collapsed.add(node);
          }
          toggle.setAttribute('aria-expanded', String(open));
        });
        wrapper.append(toggle);
        if (schema.desp) {
          wrapper.append(element('div', 'form-text', SettingsI18n.t(schema.desp)));
        }
        wrapper.append(children);
        const feedback = element('div', 'invalid-feedback');
        groups.set(node, wrapper);
        feedbacks.set(node, feedback);
        wrapper.append(feedback);
        if (node.object) {
          renderScope(children, node.object, path);
        } else {
          renderArray(children, node, path);
        }
        return wrapper;
      }
      const label = element('label', 'form-label', title);
      label.htmlFor = node.id;
      let control: Control;
      if (schema.type === 'single-select' || schema.type === 'multi-select') {
        const select = element('select', 'form-select');
        select.multiple = schema.type === 'multi-select';
        const selected = Array.isArray(node.value) ? node.value.map(String) : [String(node.value)];
        const values = [...new Set([...schema.options, ...selected.filter((value) => !schema.options.includes(value))])];
        values.forEach((value) => {
          const index = schema.options.indexOf(value);
          const option = element('option', '', SettingsI18n.t(schema.optionsName?.[index] || value));
          option.value = value;
          option.selected = selected.includes(value);
          select.append(option);
        });
        control = select;
      } else if ((schema.type === 'text' || schema.type === 'integer-array') && schema.inputType === 'textarea') {
        control = element('textarea', 'form-control');
        control.value = String(node.value);
      } else {
        const input = element('input', 'form-control');
        if (schema.type === 'boolean') {
          input.type = 'checkbox';
          input.className = 'form-check-input';
          input.checked = node.value === true;
          wrapper.classList.add('form-check', 'form-switch');
        } else {
          input.type = schema.type === 'text' ? schema.inputType || 'text' : 'text';
          if (input.type === 'number') {
            input.step = 'any';
          }
          input.value = String(node.value);
        }
        control = input;
      }
      control.id = node.id;
      control.name = node.name;
      control.required = schema.required === true;
      if (schema.type === 'text' || schema.type === 'integer-array') {
        (control as HTMLInputElement).placeholder = SettingsI18n.t(schema.placeholder || '');
      }
      if (schema.type === 'integer-array') {
        control.dataset.valueType = 'integer-array';
      }
      controls.set(node, control);
      nodes.set(control, node);
      wrapper.append(label, control);
      if (schema.desp) {
        const help = element('div', 'form-text', SettingsI18n.t(schema.desp));
        help.id = `${node.id}-help`;
        control.setAttribute('aria-describedby', help.id);
        wrapper.append(help);
      }
      if (schema.type === 'single-select' && schema.bindValue) {
        const branches = element('div', 'settings-branch');
        branchViews.set(node, { container: branches, parentPath });
        wrapper.append(branches);
        renderBranch(node);
      }
      return wrapper;
    }
    const fields = element('div', 'settings-fields');
    renderScope(fields, scope, '');
    form.append(fields);
    form.noValidate = true;
    form.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (target) {
        actions.get(target)?.();
      }
    });
    const update = (event: Event): void => {
      const target = event.target as Control;
      const node = nodes.get(target);
      if (!node) {
        return;
      }
      capture(node, target);
      target.setCustomValidity('');
      target.classList.remove('is-invalid');
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    function validate(): boolean {
      sync();
      let first: HTMLElement | undefined;
      SettingsModel.walk(scope, (node) => {
        const control = controls.get(node);
        const error = SettingsModel.validate(node);
        if (!control) {
          const feedback = feedbacks.get(node);
          if (feedback) {
            feedback.textContent = error;
            feedback.style.display = error ? 'block' : 'none';
          }
          if (error && !first) {
            first = groups.get(node);
          }
          return;
        }
        control.setCustomValidity(error);
        const invalid = !control.checkValidity();
        if (invalid && !error) {
          control.setCustomValidity(SettingsI18n.t('Invalid format'));
        }
        control.classList.toggle('is-invalid', invalid);
        if (invalid && !first) {
          first = control;
        }
      });
      if (first) {
        let parent = first.parentElement;
        while (parent && parent !== form) {
          if (parent.classList.contains('collapse')) {
            parent.classList.add('show');
            const node = collapseNodes.get(parent);
            if (node) {
              collapsed.delete(node);
            }
            parent.parentElement?.querySelector('[aria-controls]')?.setAttribute('aria-expanded', 'true');
          }
          parent = parent.parentElement;
        }
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (first instanceof HTMLInputElement || first instanceof HTMLSelectElement || first instanceof HTMLTextAreaElement) {
          first.reportValidity();
        }
        return false;
      }
      return true;
    }
    return { validate, sync };
  }
  return { element, button, render };
})();
Object.assign(globalThis, { SettingsView });
