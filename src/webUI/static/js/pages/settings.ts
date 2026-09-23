/**
 * @file src/webUI/static/js/pages/settings.ts
 * @description 协调模板加载、编辑与经过校验的 Manager 配置接口。
 */
(async () => {
  if (typeof ManagerAuth !== 'undefined' && !await ManagerAuth.ready) {
    return;
  }
  SettingsI18n.localize();
  const {
    element, button
  } = SettingsView;
  let baseline: SettingsData | undefined;
  let loading = false;
  let saving = false;
  let loadVersion = 0;
  let activeLoad: AbortController | undefined;
  let retryLoad: (() => Promise<void>) | undefined;
  const container = document.querySelector<HTMLElement>('div.container')!;
  const editor = element('div', 'settings-editor');
  const retry = button(SettingsI18n.t('Retry loading configuration'));
  retry.hidden = true;
  container.append(retry, editor);
  retry.addEventListener('click', () => {
    void retryLoad?.();
  });

  function message(value: unknown, error = false): void {
    document.querySelector('#modalLabel')!.textContent = error ? SettingsI18n.t('Error') : SettingsI18n.t('Info');
    (document.querySelector('#modalBody>textarea') as HTMLTextAreaElement).value = String(value);
    document.querySelector('#modal')!.classList.add('open');
  }
  function updateBusy(): void {
    editor.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((submit) => {
      submit.disabled = loading || saving || !baseline;
    });
    (document.querySelector('#loadRemoteFile') as HTMLButtonElement).disabled = loading || saving;
    retry.disabled = loading || saving;
  }
  function mount(templates: SettingsTemplate[], config: SettingsData): void {
    const forms = document.createDocumentFragment();
    const menu = document.createDocumentFragment();
    const entries: {
      form: HTMLFormElement;
      link: HTMLButtonElement
    }[] = [];
    const select = (index: number): void => {
      entries.forEach((entry, position) => {
        entry.form.hidden = position !== index;
        entry.link.classList.toggle('active', position === index);
      });
      const selected = document.querySelector('#single-config-name>button') as HTMLButtonElement;
      selected.textContent = SettingsI18n.t(templates[index].name);
      selected.dataset.name = templates[index].name;
    };
    templates.forEach((template, index) => {
      const scope = SettingsModel.createScope(template.body, config);
      let savedBaseline = config;
      const form = element('form', 'settings-form');
      form.id = `settings-form-${index}`;
      form.dataset.type = template.type;
      if (template.quote) {
        const quote = element('figure', 'text-center settings-quote');
        quote.append(element('blockquote', 'blockquote', SettingsI18n.t(template.quote)));
        if (template.author) {
          quote.append(element('figcaption', 'blockquote-footer', SettingsI18n.t(template.author)));
        }
        form.append(quote);
      }
      const view = SettingsView.render(form, scope);
      const submit = button(SettingsI18n.t('Save'), 'btn btn-primary settings-save');
      submit.type = 'submit';
      const footer = element('div', 'settings-savebar');
      footer.append(element('span', '', SettingsI18n.t('Changes are applied when you save.')), submit);
      form.append(footer);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (loading || saving || !baseline) {
          return;
        }
        try {
          if (!view.validate()) {
            return;
          }
          const edited = SettingsModel.serialize(scope, baseline);
          SettingsModel.assertCompatible(scope, savedBaseline, baseline, edited);
          saving = true;
          submit.textContent = SettingsI18n.t('Saving...');
          updateBusy();
          const restartRequired = await SettingsApi.setConfig(edited, template.type);
          baseline = edited;
          savedBaseline = edited;
          message(restartRequired ? SettingsI18n.t('Saved. Restart required for the changed server settings.') : SettingsI18n.t('Success'));
        } catch (error) {
          message(SettingsApi.formatRequestError(error), true);
        } finally {
          saving = false;
          submit.textContent = SettingsI18n.t('Save');
          updateBusy();
        }
      });
      const link = button(SettingsI18n.t(template.name), 'dropdown-item');
      link.addEventListener('click', () => select(index));
      const item = element('li');
      item.append(link);
      menu.append(item);
      forms.append(form);
      entries.push({
        form,
        link
      });
    });
    select(0);
    editor.replaceChildren(forms);
    document.querySelector('#single-config-name>ul')!.replaceChildren(menu);
  }
  async function load(source: (signal: AbortSignal) => Promise<string>): Promise<void> {
    if (saving) {
      return;
    }
    const version = ++loadVersion;
    activeLoad?.abort();
    const controller = new AbortController();
    activeLoad = controller;
    retryLoad = () => load(source);
    loading = true;
    updateBusy();
    document.querySelector('#modal-loading')!.classList.add('open');
    try {
      const text = await source(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      const templates = SettingsModel.parseTemplates(text);
      const config = await SettingsApi.getConfig(controller.signal);
      if (version !== loadVersion) {
        return;
      }
      mount(templates, config);
      baseline = config;
      retry.hidden = true;
      ['#file-selector', '#loadRemoteFileLabel', '#loadRemoteFileInput'].forEach((selector) => {
        (document.querySelector(selector) as HTMLElement).hidden = true;
      });
    } catch (error) {
      if (version === loadVersion) {
        baseline = undefined;
        retry.hidden = false;
        message(SettingsApi.formatRequestError(error), true);
      }
    } finally {
      if (version === loadVersion) {
        activeLoad = undefined;
        loading = false;
        updateBusy();
        document.querySelector('#modal-loading')!.classList.remove('open');
      }
    }
  }
  function loadRemoteTemplate(url: string): Promise<void> {
    return load((signal) => SettingsApi.getTemplate(url, signal));
  }
  document.querySelector('#loadRemoteFile')!.addEventListener('click', () => {
    const url = (document.querySelector('#remote-url') as HTMLInputElement).value.trim();
    if (url) {
      void loadRemoteTemplate(url);
    }
  });
  document.querySelector('#readTemplateFile')!.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      void load(() => file.text());
    }
  });
  const dropArea = document.querySelector('#file-selector')!;
  dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = (event as DragEvent).dataTransfer?.files[0];
    if (file) {
      void load(() => file.text());
    }
  });
  const back = document.querySelector<HTMLElement>('#back2top')!;
  let backVisible = false;
  const updateBack = (): void => {
    const visible = window.scrollY > 50;
    if (visible !== backVisible) {
      back.style.display = visible ? 'block' : 'none';
      backVisible = visible;
    }
  };
  window.addEventListener('scroll', updateBack, {
    passive: true
  });
  back.addEventListener('click', () => document.body.scrollIntoView());
  updateBack();
  void loadRemoteTemplate('/js/template.yml');
})();
