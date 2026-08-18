/** @description Source module for the browser YAML configuration editor. */
(async () => {
  interface TemplateOption {
    type: string;
    [key: string]: any;
  }
  interface ConfigTemplate {
    name: string;
    body: Record<string, TemplateOption>;
    type?: string;
    filename?: string;
    quote?: string;
    author?: string;
  }
  type ConfigData = Record<string, any>;
  const setModalOpen = (selector: string, open: boolean): void => {
    document.querySelector(selector)?.classList.toggle('open', open);
  };

  dom(document).ready(() => {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        dom('#back2top').fadeIn();
      } else {
        dom('#back2top').fadeOut();
      }
    });
    dom('#back2top').click(() => {
      document.body.scrollIntoView();
      return false;
    });
  });
  const fileLink = '/js/template.yml';
  if (fileLink) {
    loadRemoteTemplate(decodeURIComponent(fileLink));
  }
  const dropArea = dom('#file-selector')[0] as HTMLElement;
  dropArea.addEventListener('dragover', (event: DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  });
  dropArea.addEventListener('drop', async (event: DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const fileList = event.dataTransfer?.files;
    if (!fileList) {
      return;
    }
    if (fileList.length > 0) {
      const template = await readFile(fileList[0]).then((data) => data).catch((error) => {
        console.log(error);
        showError(error);
        return '';
      });
      if (!template) {
        showError('The file content is empty!');
        return;
      }
      loadTemplate(template);
    }
  });
  dom('#readTemplateFile')[0].addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const template = await readFile(input.files[0]).then((data) => data).catch((error) => {
      console.error(error);
      showError(error);
      return '';
    });
    if (!template) {
      showError('The file content is empty!');
      return;
    }
    loadTemplate(template);
  });
  dom('#loadRemoteFile').click(async (event) => {
    const remoteUrl = dom('#remote-url').val();
    if (!remoteUrl) {
      return;
    }
    dom(event.target).attr('disabled', 'disabled')
      .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Loading...');
    await loadRemoteTemplate(String(remoteUrl));
    dom(event.target).text('Save').removeAttr('disabled');
  });
  async function loadRemoteTemplate(fileLink: string): Promise<void> {
    const fileUrl = new URL(fileLink, location.href);
    if (fileUrl.search) {
      fileUrl.search += `&time=${Date.now()}`;
    } else {
      fileUrl.search += `?time=${Date.now()}`;
    }
    setModalOpen('#modal-loading', true);
    const [status, template] = await axios.get(fileUrl.href, {
      validateStatus: (status) => status >= 200 && status < 400
    }).then((response) => [true, response.data]).catch((error) => {
      console.error(error);
      return [false, error];
    });
    setModalOpen('#modal-loading', false);
    if (!status) {
      showError(template.message, 'Get template file failed!');
      return;
    }
    loadTemplate(template);
  }
  async function loadTemplate(template: string): Promise<void> {
    const templateJson = formatChecker(template);
    if (!templateJson) {
      return;
    }

    const oldConfig = await getConfig();

    dom('#file-selector,#loadRemoteFileLabel,#loadRemoteFileInput').hide();
    templateJson.forEach((singleConfig, index) => {
      if (oldConfig) {
        singleConfig.body = setDefaultConfig(singleConfig.body, oldConfig);
      }
      // 多配置文件处理
      dom('div.container').append(`<form id="config-${htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/ig, '')}" style="display:none;" data-type="${singleConfig.type || singleConfig.filename?.split('.').slice(0, -1).join('.') || ''
      }" data-filename="${singleConfig.filename || `${singleConfig.name}.${singleConfig.type}`}">
        ${singleConfig.quote ? `<figure class="text-center" style="border: 1px dashed #00c9ff;border-radius: 5px;">
          <blockquote class="blockquote">
            <p>${singleConfig.quote}</p>
          </blockquote>
          ${singleConfig.author ? `<figcaption class="blockquote-footer" style="margin-bottom: .5rem;">${singleConfig.author}</figcaption>` : ''}
        </figure>` : ''}
      </form>`);
      if (index === 0) {
        dom('#single-config-name>button').attr('data-name', htmlDecode(singleConfig.name));
        dom('#single-config-name>button').text(htmlDecode(singleConfig.name));
        dom(`#config-${htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/gi, '')}`).show();
      }
      const singleConfigList = dom(`<li><a class="dropdown-item${index === 0 ? ' active' : ''}" href="javascript:void(0);">${singleConfig.name}</a></li>`);
      singleConfigList.click(function () {
        const name = dom(this).text().trim();
        dom('#single-config-name>button').attr('data-name', name);
        dom('#single-config-name>button').text(name);
        dom('#single-config-name li>a').removeClass('active');
        dom(this).children('a').addClass('active');
        // show
        dom('form').hide();
        dom(`#config-${name.replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/gi, '')}`).show();
      });
      dom('#single-config-name>ul').append(singleConfigList);
      // 配置项处理
      Object.entries(singleConfig.body).forEach(([name, options]) => {
        generateBody(htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/ig, ''), name, options);
      });
    });
    dom('button.repeat').on('click', repeatButton);
    dom('button.delete-repeat').on('click', (event) => {
      if (dom(event.target).parent().parent()
        .parent()
        .children().length > 1) {
        dom(event.target).parent().parent()
          .remove();
      } else {
        dom(event.target).parent().parent()
          .find('input')
          .val('');
      }
    });
    const generatorButton = dom('<button class="btn btn-primary" type="submit" style="margin-bottom: 1rem;">Save</button>');
    dom('form').append(generatorButton).submit(async function (event) {
      dom(this).children('button[type="submit"]').attr('disabled', 'disabled')
        .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Loading...');
      if (!(event.target as HTMLFormElement).checkValidity()) {
        dom(this).children('button[type="submit"]').text('Save')
          .removeAttr('disabled');
        event.stopPropagation();
      }
      event.preventDefault();
      const form = dom(this);
      for (const element of form.find('[data-validation]').elements) {
        dom(element).removeClass('is-invalid').removeClass('is-valid');
        if (!new RegExp(dom(element).attr('data-validation') ?? '').test(String(dom(element).val()))) {
          dom(element).addClass('is-invalid');
        }
      }
      if (form.find('.is-invalid[data-validation]').length > 0) {
        dom(this).children('button[type="submit"]').text('Save')
          .removeAttr('disabled');
        form.find('.is-invalid[data-validation]')[0].scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const config = generateData(form);
      let result = '';
      console.log(config);
      if (form.attr('data-type') === 'json') {
        result = JSON.stringify(config, null, 2);
      }
      if (['yml', 'yaml'].includes(form.attr('data-type') ?? '')) {
        result = jsyaml.dump(config, { lineWidth: -1, forceQuotes: true });
      }
      if (['ini'].includes(form.attr('data-type') ?? '')) {
        result = object2ini(config);
      }
      await setConfig(result);
      /*
      if (form.attr('data-filename') === 'copy') {
        dom('#modalLabel').html('<span class="badge rounded-pill text-bg-success">Success</span>');
        dom('#modalBody>textarea').val(result);
        setModalOpen('#modal', true);
      } else {
        download(result, form.attr('data-filename'), form.attr('data-type'));
      }
      */
      dom(this).children('button[type="submit"]').text('Save')
        .removeAttr('disabled');
    });
  }
  function repeatButton(event: Event): void {
    const parent = dom(event.target).parent().parent();
    const oldNameId = parent.children('div.collapse').attr('name');
    const newNameId = parent.parent().children().length;
    const replaceRule: [RegExp, string] = [new RegExp(`${oldNameId}$`), String(newNameId)];
    const copyElement = dom(String(parent.prop('outerHTML') ?? ''));
    copyElement.children().map((index, element) => {
      const id = dom(element).attr('id');
      if (id) {
        dom(element).attr('id', id.replace(...replaceRule));
      }
      const name = dom(element).attr('name');
      if (name) {
        dom(element).attr('name', newNameId);
      }
      return element;
    });
    copyElement.children('p').children('a').map((index, element) => {
      const href = dom(element).attr('href');
      if (href) {
        dom(element).attr('href', href.replace(...replaceRule));
      }
      const ariaControls = dom(element).attr('aria-controls');
      if (ariaControls) {
        dom(element).attr('aria-controls', ariaControls.replace(...replaceRule));
      }
      return element;
    });
    copyElement.children('p').children('button').map((index, element) => {
      const dataId = dom(element).attr('data-id');
      if (dataId) {
        dom(element).attr('data-id', dataId.replace(...replaceRule));
      }
      const dataName = dom(element).attr('data-name');
      if (dataName) {
        dom(element).attr('data-name', newNameId);
      }
      return element;
    });
    copyElement.children('div.collapse').children().map((index, element) => {
      const name = dom(element).children('[name]').attr('name');
      const childrenReplaceRule: [RegExp, string] = [new RegExp(`${oldNameId}-${name}$`), `${newNameId}-${name}`];
      dom(element).children().map((childrenIndex, childrenElement) => {
        const id = dom(childrenElement).attr('id');
        if (id) {
          dom(childrenElement).attr('id', id.replace(...childrenReplaceRule));
        }
        const dataParent = dom(childrenElement).attr('data-parent');
        if (dataParent) {
          dom(childrenElement).attr('data-parent', dataParent.replace(...replaceRule));
        }
        const forId = dom(childrenElement).attr('for');
        if (forId) {
          dom(childrenElement).attr('data-parent', forId.replace(...childrenReplaceRule));
        }
        const ariaDescribedby = dom(childrenElement).attr('aria-describedby');
        if (ariaDescribedby) {
          dom(childrenElement).attr('aria-describedby', ariaDescribedby.replace(...childrenReplaceRule));
        }
        return childrenElement;
      });
      return element;
    });
    copyElement.children().children('button.repeat').map((index, element) => {
      const deleteRepeatButton = dom(element).clone();
      deleteRepeatButton.removeClass('repeat').addClass('delete-repeat').text('-')
        .attr('style', '--bs-btn-padding-y: .02rem; --bs-btn-padding-x: .39rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;width: 37px;');
      if (dom(element).prev().hasClass('delete-repeat')) {
        dom(element).prev().remove();
      }
      dom(element).before(deleteRepeatButton);
      return element;
    });
    copyElement.children().children().children('input')
      .attr('value', '');
    parent.after(String(copyElement.prop('outerHTML') ?? ''));
    dom('button.delete-repeat').off('click').on('click', (event) => {
      if (dom(event.target).parent().parent()
        .parent()
        .children().length > 1) {
        dom(event.target).parent().parent()
          .remove();
      } else {
        dom(event.target).parent().parent()
          .find('input')
          .val('');
      }
    });
    dom('button.repeat').off('click', repeatButton).on('click', repeatButton);
  }
  function generateData(parent: NativeDom, isArray = false): ConfigData | any[] {
    const config: any = isArray ? [] : {};
    parent.find(`[data-parent="${(parent.attr('id') ?? '').replace('config-', '')}"]:visible`).map((index, element) => {
      if (dom(element).attr('type') === 'object') {
        if (isArray) {
          config.push(generateData(dom(element)));
          return element;
        }
        config[String(dom(element).attr('name') ?? '')] = generateData(dom(element));
        return element;
      }
      if (dom(element).attr('type') === 'array') {
        const arrayConfig = generateData(dom(element), true);
        if (isArray) {
          config.push(arrayConfig);
          return element;
        }
        config[String(dom(element).attr('name') ?? '')] = arrayConfig;
        return element;
      }
      if (dom(element).attr('type') === 'checkbox') {
        if (isArray) {
          config.push(dom(element).prop('checked'));
          return element;
        }
        config[String(dom(element).attr('name') ?? '')] = dom(element).prop('checked');
        return element;
      }
      if (dom(element).attr('type') === 'number') {
        if (isArray) {
          config.push(parseFloat(String(dom(element).val())));
          return element;
        }
        config[String(dom(element).attr('name') ?? '')] = parseFloat(String(dom(element).val()));
        return element;
      }
      if (isArray) {
        config.push(dom(element).val());
        return element;
      }
      config[String(dom(element).attr('name') ?? '')] = dom(element).val();
      return element;
    });
    return config;
  }
  function generateBody(preId: string, name: string | number, options: TemplateOption, parentType = '', bindName = '', bindValue = ''): void {
    const id = `${preId}-${name}`;
    // text
    if (options.type === 'text') {
      if (options.inputType === 'textarea') {
        dom(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
          <label for="${id}" class="form-label">
            ${options.name || name}${options.required ? '<font style="color:red;" title="Required">*</font>' : ''}
            ${`${options.validation}` ? '<font style="color:blue;" title="RegExp Validation">!</font>' : ''}
            ${(parentType === 'array' && options.repeat === true) ? `<button type="button" class="btn btn-outline-primary repeat"
            data-id="${id}" data-name="${name}"
            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
          </label>
          <textarea type="text" class="form-control item" id="${id}" name="${name}" data-parent="${preId}"
            ${options.desp ? ` aria-describedby="help-${id}"` : ''}
            ${options.placeholder ? ` placeholder="${options.placeholder}"` : ''}
            ${options.required ? ' required' : ''}
            ${`${options.defaultValue ?? ''}` ? ` value="${options.defaultValue}"` : ''}
            ${options.validation ? ` data-validation="${options.validation}"` : ''}
          ></textarea>
          ${options.validation ? '<div class="invalid-feedback">Invalid format!</div>' : ''}
          ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}
        </div>`);
        return;
      }
      dom(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <label for="${id}" class="form-label">${options.name || name}${options.required ? '<font style="color:red;" title="Required">*</font>' : ''}
            ${options.validation ? '<font style="color:blue;" title="RegExp Validation">!</font>' : ''}
            ${(parentType === 'array' && options.repeat === true) ? `<button type="button"
          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"
          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
        </label>
        <input type="${options.inputType || 'text'}" class="form-control" id="${id}" name="${name}" data-parent="${preId}"
          ${options.desp ? ` aria-describedby="help-${id}"` : ''}
          ${options.placeholder ? ` placeholder="${options.placeholder}"` : ''}
          ${options.required ? ' required' : ''}
          ${`${options.defaultValue ?? ''}` ? ` value="${options.defaultValue}"` : ''}
          ${options.validation ? ` data-validation="${options.validation}"` : ''}
        />
        ${options.validation ? '<div class="invalid-feedback">Invalid format!</div>' : ''}
        ${options.desp ? `<div id="help-${id}" class="form-text">${htmlDecode(options.desp)}</div>` : ''}
      </div>`);
      return;
    }
    // boolean
    if (options.type === 'boolean') {
      dom(`#config-${preId}`).append(`<div class="form-check form-switch mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <input class="form-check-input" type="checkbox" role="switch" id="${id}" name="${name}" data-parent="${preId}"
          ${options.desp ? ` aria-describedby="help-${id}"` : ''}
          ${options.defaultValue ? ' checked="checked"' : ''}
          />
        <label class="form-check-label" for="${id}">${options.name || name}${(parentType === 'array' && options.repeat === true) ? `<button type="button"
          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"
          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
        </label>
        ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}
      </div>`);
      return;
    }
    // single-select
    if (options.type === 'single-select') {
      dom(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <label class="form-select-label" for="${id}">${options.name || name}${(parentType === 'array' && options.repeat === true) ? `<button type="button"
          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"
          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
        </label>
        <select class="form-select" id="${id}" name="${name}" data-parent="${preId}"
        ${options.desp ? ` aria-describedby="help-${id}"` : ''}>
          ${options.options.map((option: string, index: number) => `<option value="${option}" ${option === options.defaultValue ? ' selected' : ''}>
          ${options.optionsName?.[index] ? options.optionsName[index] : option}</option>`).join('')}
        </select>
        ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}
      </div>`);
      if (options.bindValue) {
        if (options.bindValue.isChildren) {
          dom(`#${id}`).data('bindData', options.bindValue.body);
          dom(`#${id}`).change(function () {
            dom(`#config-${preId} [bind-value="${name}"]`).remove();
            const data = (dom(this).data('bindData') as Record<string, Record<string, TemplateOption>>)[String(dom(this).val())];
            if (data) {
              Object.entries(data as Record<string, TemplateOption>).forEach(([subName, subOptions]) => {
                generateBody(preId, subName, subOptions, options.type, '', String(name));
              });
              dom(`#config-${preId} [bind-value="${name}"]`).show();
            }
          });
          const data = options.bindValue.body[options.defaultValue];
          if (data) {
            Object.entries(data as Record<string, TemplateOption>).forEach(([subName, subOptions]) => {
              generateBody(preId, subName, subOptions, options.type, '', String(name));
            });
            dom(`#config-${preId} [bind-value="${name}"]`).show();
          }
          return;
        }
        dom(`#${id}`).data('bindData', options.bindValue.body);
        dom(`#${id}`).change(function () {
          dom(`#config-${preId} [bind-name="${name}"]`).hide();
          dom(`#config-${preId} [bind-value="${dom(this).val()}"]`).show();
        });
        Object.entries(options.bindValue.body).forEach(([bindValue, data]) => {
          Object.entries(data as Record<string, TemplateOption>).forEach(([subName, subOptions]) => {
            generateBody(preId, subName, subOptions, options.type, String(name), bindValue);
          });
        });
        const data = options.bindValue.body[options.defaultValue];
        if (data) {
          dom(`#config-${preId} [bind-value="${options.defaultValue}"]`).show();
        }
      }
      return;
    }
    // multi-select
    if (options.type === 'multi-select') {
      dom(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <label class="form-select-label" for="${id}">${options.name || name}${(parentType === 'array' && options.repeat === true) ? `<button type="button"
          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"
          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
        </label>
        <select class="form-select" id="${id}" name="${name}" multiple data-parent="${preId}"
        ${options.desp ? ` aria-describedby="help-${id}"` : ''}>
          ${options.options.map((option: string, index: number) => `<option value="${option}"
          ${(options.defaultValue || []).includes(option) ? ' selected' : ''}>
          ${options.optionsName?.[index] ? options.optionsName[index] : option}</option>`).join('')}
        </select>
        ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}
      </div>`);
      return;
    }
    // object
    if (options.type === 'object') {
      dom(`#config-${preId}`).append(`<div class="card card-body" style="padding-bottom:0;margin-bottom:1rem;${parentType === 'single-select' ? 'display: none;' : ''}"
      ${parentType === 'single-select' ? ` bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <p style="text-align:center;margin-bottom:0;"">
          <a class="btn btn-primary" data-ui-toggle="collapse" href="#config-${preId}-${name}" role="button" aria-expanded="true"
            aria-controls="config-${preId}-${name}" title="Click to hide/show the options about ${options.name || name}.">
            ${options.name || name}
          </a>
          ${(parentType === 'array' && options.repeat === true) ? `<button type="button" class="btn btn-outline-primary delete-repeat"
            data-id="config-${preId}-${name}" data-name="${name}"
            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;width: 37px;">-</button><button type="button" class="btn btn-outline-primary repeat"
            data-id="config-${preId}-${name}" data-name="${name}"
            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
          ${options.desp ? `<div id="configHelp-${preId}-${name}" class="form-text">${options.desp}</div>` : ''}
        </p><div id="config-${preId}-${name}" class="collapse show" name="${name}" type="object" data-parent="${preId}"></div>

      </div>`);
      Object.entries(options.body as Record<string, TemplateOption>).forEach(([subName, subOptions]) => {
        generateBody(`${preId}-${name}`, subName, subOptions, options.type);
      });
    }
    // array
    if (options.type === 'array') {
      dom(`#config-${preId}`).append(`<div class="card card-body" style="padding-bottom:0;margin-bottom:1rem;${parentType === 'single-select' ? 'display: none;' : ''}"
      ${parentType === 'single-select' ? ` bind-name="${bindName}" bind-value="${bindValue}"` : ''}>
        <p style="text-align:center;margin-bottom:0;">
          <a class="btn btn-primary" data-ui-toggle="collapse" href="#config-${preId}-${name}" role="button" aria-expanded="true"
            aria-controls="config-${preId}-${name}" title="Click to hide/show the options about ${options.name || name}.">
            ${options.name || name}
          </a>
          ${(parentType === 'array' && options.repeat === true) ? `<button type="button" class="btn btn-outline-primary delete-repeat"
            data-id="config-${preId}-${name}" data-name="${name}"
            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;width: 37px;">-</button><button type="button" class="btn btn-outline-primary repeat"
            data-id="config-${preId}-${name}" data-name="${name}"
            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}
          ${options.desp ? `<div id="configHelp-${preId}-${name}" class="form-text">${options.desp}</div>` : ''}
        </p><div id="config-${preId}-${name}" class="collapse show" name="${name}" type="array" data-parent="${preId}"></div>
      </div>`);
      const arrayBody: TemplateOption[] = [];
      options.body.forEach((subOptions: TemplateOption) => {
        if (typeof subOptions.repeat === 'number' && subOptions.repeat > 0) {
          arrayBody.push(...(new Array(subOptions.repeat).fill(subOptions)));
          return;
        }
        arrayBody.push(subOptions);
      });
      arrayBody.forEach((subOptions, subName) => {
        generateBody(`${preId}-${name}`, subName, subOptions, options.type);
      });
    }
  }
  async function getConfig(): Promise<ConfigData | false> {
    if (!sessionStorage?.managerServerSecret) {
      return false;
    }
    return axios.get('/api/config', {
      headers: { Authorization: `Bearer ${sessionStorage.managerServerSecret}` }
    }).then(async (response) => {
      console.log(response);
      if (response.status === 200) {
        try {
          return jsyaml.load(response.data) as ConfigData;
        } catch (_e) {
          return false;
        }
      }
      return false;
    }).catch((error) => {
      console.error(error);
      return false;
    });
  }
  async function setConfig(data: string): Promise<boolean> {
    if (!sessionStorage?.managerServerSecret) {
      return false;
    }
    return axios.put('/api/config', { config: data }, {
      headers: { Authorization: `Bearer ${sessionStorage.managerServerSecret}` }
    }).then(async (response) => {
      console.log(response);
      if (response.status === 200) {
        showMsg('Success');
        return true;
      }
      showError(response.status);
      return false;
    }).catch((error) => {
      showError(error instanceof Error ? error.message : String(error));
      console.error(error);
      return false;
    });
  }
  function setDefaultConfig(data: Record<string, TemplateOption>, config: ConfigData): Record<string, TemplateOption> {
    return Object.fromEntries(Object.entries(data).map(([name, value]) => {
      if (config[name] || !(config[name] ?? true)) {
        if (typeof config[name] === 'object' && !Array.isArray(config[name])) {
          value.body = setDefaultConfig(value.body, config[name]);
          return [name, value];
        }
        if (['artifacts'].includes(name)) {
          const template = JSON.stringify(value.body[0]);
          for (let i = 0; i < config[name].length; i++) {
            const temp = JSON.parse(template);
            temp.body = JSON.parse(JSON.stringify(setDefaultConfig(temp.body, config[name][i])));
            value.body[i] = temp;
          }
          return [name, value];
        }
        if (config[name] === null && Array.isArray(value.defaultValue)) {
          value.defaultValue = [];
        } else {
          value.defaultValue = config[name];
        }
        if (value.bindValue) {
          value.bindValue.body[value.defaultValue] = setDefaultConfig(value.bindValue.body[value.defaultValue], config);
          return [name, value];
        }
        return [name, value];
      }
      return [name, value];
    }));
  }
  /*
  function download(data, filename, type) {
    const file = new Blob([data], { type });
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(file, filename);
    } else {
      const a = document.createElement('a');
      const url = URL.createObjectURL(file);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  }
  */
  function formatChecker(template: string): ConfigTemplate[] | false {
    try {
      const templateJson = jsyaml.load(template) as unknown;
      console.log(templateJson);
      if (!Array.isArray(templateJson)) {
        showError('The root template must be an array!');
        return false;
      }
      for (let i = 0; i < templateJson.length; i++) {
        // root template check
        if (!templateJson[i].name) {
          showError(`The template of No.${i + 1} has no the key: "name".`);
          return false;
        }
        if (!templateJson[i].body) {
          showError(`The template of No.${i + 1} has no the key: "body".`);
          return false;
        }
        if (!templateJson[i].type && !templateJson[i].filename) {
          showError(`The template of No.${i + 1} has no the keys: "type", "filename".\nYou have to input at least one of them.`);
          return false;
        }
      }
      console.log(templateJsonSafety(templateJson));
      return templateJsonSafety(templateJson) as ConfigTemplate[];
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
  function templateJsonSafety(templateJson: any): any {
    if (Array.isArray(templateJson)) {
      return templateJson.map((value) => {
        if (typeof value === 'string') {
          return htmlEncode(value);
        }
        if (value && typeof value === 'object') {
          return templateJsonSafety(value);
        }
        return value;
      });
    }
    return Object.fromEntries(Object.entries(templateJson).map(([name, value]) => {
      if (typeof value === 'string') {
        return [htmlEncode(name), htmlEncode(value)];
      }
      if (value && typeof value === 'object') {
        return [htmlEncode(name), templateJsonSafety(value)];
      }
      return [htmlEncode(name), value];
    }));
  }
  function showError(message: unknown, title = ''): void {
    dom('#modalLabel').html(`<span class="badge rounded-pill text-bg-danger">Error</span>${title || ''}`);
    dom('#modalBody>textarea').val(String(message));
    setModalOpen('#modal', true);
  }
  function showMsg(message: unknown, title = ''): void {
    dom('#modalLabel').html(`<span class="badge rounded-pill text-bg-danger">Info</span>${title || 'Info'}`);
    dom('#modalBody>textarea').val(String(message));
    setModalOpen('#modal', true);
  }
  function object2ini(data: ConfigData | any[], parentKey = ''): string {
    return Object.entries(data).map(([key, value]) => {
      if (typeof value === 'object') {
        return object2ini(value, `${parentKey}${key}.`);
      }
      return `${parentKey}${key}=${value}`;
    }).join('\n');
  }
  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('error', () => {
        console.error(`Error occurred reading file: ${file.name}`);
        reject(`Error occurred reading file: ${file.name}`);
      });
      reader.addEventListener('load', (event) => {
        resolve(String(event.target?.result ?? ''));
      });
      reader.readAsText(file);
    });
  }
  function htmlEncode(str: string): string {
    if (str.length === 0) {
      return '';
    }
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;');
  }
  function htmlDecode(str: string): string {
    if (str.length === 0) {
      return '';
    }
    return str.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, '\'')
      .replace(/&quot;/g, '"');
  }
})();
