/* eslint-disable max-len */
/* global window, document, location, localStorage, FileReader, $, bootstrap, axios, jsyaml */
(async () => {
  $(document).ready(() => {
    $(window).scroll(function () {
      if ($(this).scrollTop() > 50) {
        $('#back2top').fadeIn();
      } else {
        $('#back2top').fadeOut();
      }
    });
    $('#back2top').click(() => {
      document.body.scrollIntoView();
      return false;
    });
    new bootstrap.Tooltip($('#back2top')[0]);
  });
  const fileLink = '/js/template.yml';
  if (fileLink) {
    loadRemoteTemplate(decodeURIComponent(fileLink));
  }
  const [dropArea] = $('#file-selector');
  dropArea.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  dropArea.addEventListener('drop', async (event) => {
    event.stopPropagation();
    event.preventDefault();
    const fileList = event.dataTransfer.files;
    if (fileList.length > 0) {
      const template = await readFile(fileList[0]).then((data) => data).catch((error) => {
        console.log(error);
        showError(error);
        return false;
      });
      if (!template) {
        showError('The file content is empty!');
        return;
      }
      loadTemplate(template);
    }
  });
  $('#readTemplateFile')[0].addEventListener('change', async (event) => {
    if (event.target.files.length === 0) {
      return;
    }
    const template = await readFile(event.target.files[0]).then((data) => data).catch((error) => {
      console.error(error);
      showError(error);
      return false;
    });
    if (!template) {
      showError('The file content is empty!');
      return;
    }
    loadTemplate(template);
  });
  $('#loadRemoteFile').click(async (event) => {
    const remoteUrl = $('#remote-url').val();
    if (!remoteUrl) {
      return;
    }
    $(event.target).attr('disabled', 'disabled')
      .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Loading...');
    await loadRemoteTemplate(remoteUrl);
    $(event.target).text('Save').removeAttr('disabled');
  });
  async function loadRemoteTemplate(fileLink) {
    const fileUrl = new URL(fileLink, location.href);
    if (fileUrl.search) {
      fileUrl.search += `&time=${Date.now()}`;
    } else {
      fileUrl.search += `?time=${Date.now()}`;
    }
    const loadingModal = new bootstrap.Modal('#modal-loading');
    loadingModal.show();
    const [status, template] = await axios.get(fileUrl.href, {
      validateStatus: (status) => status >= 200 && status < 400
    }).then((response) => [true, response.data]).catch((error) => {
      console.error(error);
      return [false, error];
    });
    const [loadingModalEl] = $('#modal-loading');
    loadingModalEl.addEventListener('shown.bs.modal', () => {
      loadingModal.hide();
    });
    loadingModal.hide();
    if (!status) {
      showError(template.message, 'Get template file failed!');
      return;
    }
    loadTemplate(template);
  }
  async function loadTemplate(template) {
    const templateJson = formatChecker(template);
    if (!templateJson) {
      return;
    }

    const oldConfig = await getConfig();

    $('#file-selector,#loadRemoteFileLabel,#loadRemoteFileInput').hide();
    templateJson.forEach((singleConfig, index) => {
      if (oldConfig) {
        singleConfig.body = setDefaultConfig(singleConfig.body, oldConfig);
      }
      // 多配置文件处理
      $('div.container').append(`<form id="config-${htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/ig, '')}" style="display:none;" data-type="${
        singleConfig.type || singleConfig.filename.split('.').slice(0, -1).join('.')
      }" data-filename="${singleConfig.filename || `${singleConfig.name}.${singleConfig.type}`}">

        ${singleConfig.quote ? `<figure class="text-center" style="border: 1px dashed #00c9ff;border-radius: 5px;">

          <blockquote class="blockquote">

            <p>${singleConfig.quote}</p>

          </blockquote>

          ${singleConfig.author ? `<figcaption class="blockquote-footer" style="margin-bottom: .5rem;">${singleConfig.author}</figcaption>` : ''}

        </figure>` : ''}

      </form>`);
      if (index === 0) {
        $('#single-config-name>button').attr('data-name', htmlDecode(singleConfig.name));
        $('#single-config-name>button').text(htmlDecode(singleConfig.name));
        $(`#config-${htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/gi, '')}`).show();
      }
      const singleConfigList = $(`<li><a class="dropdown-item${index === 0 ? ' active' : ''}" href="javascript:void(0);">${singleConfig.name}</a></li>`);
      singleConfigList.click(function () {
        const name = $(this).text().trim();
        $('#single-config-name>button').attr('data-name', name);
        $('#single-config-name>button').text(name);
        $('#single-config-name li>a').removeClass('active');
        $(this).children('a').addClass('active');
        // show
        $('form').hide();
        $(`#config-${name.replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/gi, '')}`).show();
      });
      $('#single-config-name>ul').append(singleConfigList);
      // 配置项处理
      Object.entries(singleConfig.body).forEach(([name, options]) => {
        generateBody(htmlDecode(singleConfig.name).replace(/[,./;'[\]\\<>?:"{}|`~!@#$%^&*()+=\s]/ig, ''), name, options);
      });
    });
    $('button.repeat').on('click', repeatButton);
    const generatorButton = $('<button class="btn btn-primary" type="submit" style="margin-bottom: 1rem;">Save</button>');
    $('form').append(generatorButton).submit(async function (event) {
      $(this).children('button[type="submit"]').attr('disabled', 'disabled')
        .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Loading...');
      if (!event.target.checkValidity()) {
        $(this).children('button[type="submit"]').text('Save')
          .removeAttr('disabled');
        event.stopPropagation();
      }
      event.preventDefault();
      const form = $(this);
      for (const element of $.makeArray(form.find('[data-validation]'))) {
        $(element).removeClass('is-invalid').removeClass('is-valid');
        if (!new RegExp($(element).attr('data-validation')).test($(element).val())) {
          $(element).addClass('is-invalid');
        }
      }
      if (form.find('.is-invalid[data-validation]').length > 0) {
        $(this).children('button[type="submit"]').text('Save')
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
      if (['yml', 'yaml'].includes(form.attr('data-type'))) {
        result = jsyaml.dump(config);
      }
      if (['ini'].includes(form.attr('data-type'))) {
        result = object2ini(config);
      }
      await setConfig(result);
      /*
      if (form.attr('data-filename') === 'copy') {
        $('#modalLabel').html('<span class="badge rounded-pill text-bg-success">Success</span>');
        $('#modalBody>textarea').val(result);
        new bootstrap.Modal('#modal').show();
      } else {
        download(result, form.attr('data-filename'), form.attr('data-type'));
      }
      */
      $(this).children('button[type="submit"]').text('Save')
        .removeAttr('disabled');
    });
  }
  function repeatButton(event) {
    const parent = $(event.target).parent().parent();
    const oldNameId = parent.children('div.collapse').attr('name');
    const newNameId = parent.parent().children().length;
    const replaceRule = [new RegExp(`${oldNameId}$`), newNameId];
    const copyElement = $(parent.prop('outerHTML'));
    copyElement.children().map((index, element) => {
      const id = $(element).attr('id');
      if (id) {
        $(element).attr('id', id.replace(...replaceRule));
      }
      const name = $(element).attr('name');
      if (name) {
        $(element).attr('name', newNameId);
      }
      return element;
    });
    copyElement.children('p').children('a').map((index, element) => {
      const href = $(element).attr('href');
      if (href) {
        $(element).attr('href', href.replace(...replaceRule));
      }
      const ariaControls = $(element).attr('aria-controls');
      if (ariaControls) {
        $(element).attr('aria-controls', ariaControls.replace(...replaceRule));
      }
      return element;
    });
    copyElement.children('p').children('button').map((index, element) => {
      const dataId = $(element).attr('data-id');
      if (dataId) {
        $(element).attr('data-id', dataId.replace(...replaceRule));
      }
      const dataName = $(element).attr('data-name');
      if (dataName) {
        $(element).attr('data-name', newNameId);
      }
      return element;
    });
    copyElement.children('div.collapse').children().map((index, element) => {
      const name = $(element).children('[name]').attr('name');
      const childrenReplaceRule = [new RegExp(`${oldNameId}-${name}$`), `${newNameId}-${name}`];
      $(element).children().map((childrenIndex, childrenElement) => {
        const id = $(childrenElement).attr('id');
        if (id) {
          $(childrenElement).attr('id', id.replace(...childrenReplaceRule));
        }
        const dataParent = $(childrenElement).attr('data-parent');
        if (dataParent) {
          $(childrenElement).attr('data-parent', dataParent.replace(...replaceRule));
        }
        const forId = $(childrenElement).attr('for');
        if (forId) {
          $(childrenElement).attr('data-parent', forId.replace(...childrenReplaceRule));
        }
        const ariaDescribedby = $(childrenElement).attr('aria-describedby');
        if (ariaDescribedby) {
          $(childrenElement).attr('aria-describedby', id.replace(...childrenReplaceRule));
        }
        return childrenElement;
      });
      return element;
    });
    copyElement.children().children('button.repeat').map((index, element) => {
      const deleteRepeatButton = $(element).clone();
      deleteRepeatButton.removeClass('repeat').addClass('delete-repeat').text('-')
        .attr('style', '--bs-btn-padding-y: .02rem; --bs-btn-padding-x: .39rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;');
      if ($(element).prev().hasClass('delete-repeat')) {
        $(element).prev().remove();
      }
      $(element).before(deleteRepeatButton);
      return element;
    });
    parent.after(copyElement.prop('outerHTML'));
    $('button.delete-repeat').off('click').on('click', (event) => {
      $(event.target).parent().parent()
        .remove();
    });
    $('button.repeat').off('click', repeatButton).on('click', repeatButton);
  }
  function generateData(parent, isArray) {
    const config = isArray ? [] : {};
    parent.find(`[data-parent="${parent.attr('id').replace('config-', '')}"]:visible`).map((index, element) => {
      if ($(element).attr('type') === 'object') {
        if (isArray) {
          config.push(generateData($(element)));
          return element;
        }
        config[$(element).attr('name')] = generateData($(element));
        return element;
      }
      if ($(element).attr('type') === 'array') {
        const arrayConfig = generateData($(element), true);
        if (isArray) {
          config.push(arrayConfig);
          return element;
        }
        config[$(element).attr('name')] = arrayConfig;
        return element;
      }
      if ($(element).attr('type') === 'checkbox') {
        if (isArray) {
          config.push($(element).prop('checked'));
          return element;
        }
        config[$(element).attr('name')] = $(element).prop('checked');
        return element;
      }
      if ($(element).attr('type') === 'number') {
        if (isArray) {
          config.push(parseFloat($(element).val(), 10));
          return element;
        }
        config[$(element).attr('name')] = parseFloat($(element).val(), 10);
        return element;
      }
      if (isArray) {
        config.push($(element).val());
        return element;
      }
      config[$(element).attr('name')] = $(element).val();
      return element;
    });
    return config;
  }
  function generateBody(preId, name, options, parentType, bindName, bindValue) {
    const id = `${preId}-${name}`;
    // text
    if (options.type === 'text') {
      if (options.inputType === 'textarea') {
        $(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

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
      $(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

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
      $(`#config-${preId}`).append(`<div class="form-check form-switch mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

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
      $(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

        <label class="form-select-label" for="${id}">${options.name || name}${(parentType === 'array' && options.repeat === true) ? `<button type="button"

          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"

          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}

        </label>

        <select class="form-select" id="${id}" name="${name}" data-parent="${preId}"

        ${options.desp ? ` aria-describedby="help-${id}"` : ''}>

          ${options.options.map((option, index) => `<option value="${option}" ${option === options.defaultValue ? ' selected' : ''}>

          ${options.optionsName?.[index] ? options.optionsName[index] : option}</option>`).join('')}

        </select>

        ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}

      </div>`);
      if (options.bindValue) {
        if (options.bindValue.isChildren) {
          $(`#${id}`).data('bindData', options.bindValue.body);
          $(`#${id}`).change(function () {
            $(`#config-${preId} [bind-value="${name}"]`).remove();
            const data = $(this).data('bindData')[$(this).val()];
            if (data) {
              Object.entries(data).forEach(([subName, subOptions]) => {
                generateBody(preId, subName, subOptions, options.type, '', name);
              });
              $(`#config-${preId} [bind-value="${name}"]`).show();
            }
          });
          const data = options.bindValue.body[options.defaultValue];
          if (data) {
            Object.entries(data).forEach(([subName, subOptions]) => {
              generateBody(preId, subName, subOptions, options.type, '', name);
            });
            $(`#config-${preId} [bind-value="${name}"]`).show();
          }
          return;
        }
        $(`#${id}`).data('bindData', options.bindValue.body);
        $(`#${id}`).change(function () {
          $(`#config-${preId} [bind-name="${name}"]`).hide();
          $(`#config-${preId} [bind-value="${$(this).val()}"]`).show();
        });
        Object.entries(options.bindValue.body).forEach(([bindValue, data]) => {
          Object.entries(data).forEach(([subName, subOptions]) => {
            generateBody(preId, subName, subOptions, options.type, name, bindValue);
          });
        });
        const data = options.bindValue.body[options.defaultValue];
        if (data) {
          $(`#config-${preId} [bind-value="${options.defaultValue}"]`).show();
        }
      }
      return;
    }
    // multi-select
    if (options.type === 'multi-select') {
      $(`#config-${preId}`).append(`<div class="mb-3" ${parentType === 'single-select' ? ` style="display: none;" bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

        <label class="form-select-label" for="${id}">${options.name || name}${(parentType === 'array' && options.repeat === true) ? `<button type="button"

          class="btn btn-outline-primary repeat" data-id="${id}" data-name="${name}"

          style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}

        </label>

        <select class="form-select" id="${id}" name="${name}" multiple data-parent="${preId}"

        ${options.desp ? ` aria-describedby="help-${id}"` : ''}>

          ${options.options.map((option, index) => `<option value="${option}"

          ${(options.defaultValue || []).includes(option) ? ' selected' : ''}>

          ${options.optionsName?.[index] ? options.optionsName[index] : option}</option>`).join('')}

        </select>

        ${options.desp ? `<div id="help-${id}" class="form-text">${options.desp}</div>` : ''}

      </div>`);
      return;
    }
    // object
    if (options.type === 'object') {
      $(`#config-${preId}`).append(`<div class="card card-body" style="padding-bottom:0;margin-bottom:1rem;${parentType === 'single-select' ? 'display: none;' : ''}"

      ${parentType === 'single-select' ? ` bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

        <p style="text-align:center;margin-bottom:0;"">

          <a class="btn btn-primary" data-bs-toggle="collapse" href="#config-${preId}-${name}" role="button" aria-expanded="true"

            aria-controls="config-${preId}-${name}" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="custom-tooltip"

            data-bs-title="Click to hide/show the options about ${options.name || name}.">

            ${options.name || name}

          </a>

          ${(parentType === 'array' && options.repeat === true) ? `<button type="button" class="btn btn-outline-primary repeat"

            data-id="config-${preId}-${name}" data-name="${name}"

            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}

          ${options.desp ? `<div id="configHelp-${preId}-${name}" class="form-text">${options.desp}</div>` : ''}

        </p><div id="config-${preId}-${name}" class="collapse show" name="${name}" type="object" data-parent="${preId}"></div>

      </div>`);
      Object.entries(options.body).forEach(([subName, subOptions]) => {
        generateBody(`${preId}-${name}`, subName, subOptions, options.type);
      });
    }
    // array
    if (options.type === 'array') {
      $(`#config-${preId}`).append(`<div class="card card-body" style="padding-bottom:0;margin-bottom:1rem;${parentType === 'single-select' ? 'display: none;' : ''}"

      ${parentType === 'single-select' ? ` bind-name="${bindName}" bind-value="${bindValue}"` : ''}>

        <p style="text-align:center;margin-bottom:0;">

          <a class="btn btn-primary" data-bs-toggle="collapse" href="#config-${preId}-${name}" role="button" aria-expanded="true"

            aria-controls="config-${preId}-${name}" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="custom-tooltip"

            data-bs-title="Click to hide/show the options about ${options.name || name}.">

            ${options.name || name}

          </a>

          ${(parentType === 'array' && options.repeat === true) ? `<button type="button" class="btn btn-outline-primary repeat"

            data-id="config-${preId}-${name}" data-name="${name}"

            style="--bs-btn-padding-y: 0rem; --bs-btn-padding-x: .3rem;--bs-btn-font-size: .55rem;border-radius: 50%;margin-left: .5rem;">+</button>` : ''}

          ${options.desp ? `<div id="configHelp-${preId}-${name}" class="form-text">${options.desp}</div>` : ''}

        </p><div id="config-${preId}-${name}" class="collapse show" name="${name}" type="array" data-parent="${preId}"></div>

      </div>`);
      const arrayBody = [];
      options.body.forEach((subOptions) => {
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
  async function getConfig() {
    if (!localStorage?.managerServerSecret) {
      return false;
    }
    return axios.post('/getConfig', { secret: localStorage.managerServerSecret }).then(async (response) => {
      console.log(response);
      if (response.status === 200) {
        try {
          return jsyaml.load(response.data);
        } catch (e) {
          return false;
        }
      }
      return false;
    }).catch((error) => {
      console.error(error);
      return false;
    });
  }
  async function setConfig(data) {
    if (!localStorage?.managerServerSecret) {
      return false;
    }
    return axios.post('/setConfig', { secret: localStorage.managerServerSecret, config: data }).then(async (response) => {
      console.log(response);
      if (response.status === 200) {
        showMsg('Success');
        return true;
      }
      showError(response.status);
      return false;
    }).catch((error) => {
      showError(error.message);
      console.error(error);
      return false;
    });
  }
  function setDefaultConfig(data, config) {
    return Object.fromEntries(Object.entries(data).map(([name, value]) => {
      if (config[name]) {
        if (typeof config[name] === 'object' && !Array.isArray(config[name])) {
          value.body = setDefaultConfig(value.body, config[name]);
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
  function formatChecker(template) {
    try {
      const templateJson = jsyaml.load(template);
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
      return templateJsonSafety(templateJson);
    } catch (error) {
      console.error(error);
      showError(error.message);
      return false;
    }
  }
  function templateJsonSafety(templateJson) {
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
  function showError(message, title = '') {
    $('#modalLabel').html(`<span class="badge rounded-pill text-bg-danger">Error</span>${title || ''}`);
    $('#modalBody>textarea').val(message);
    new bootstrap.Modal('#modal').show();
  }
  function showMsg(message, title = '') {
    $('#modalLabel').html(`<span class="badge rounded-pill text-bg-danger">Info</span>${title || 'Info'}`);
    $('#modalBody>textarea').val(message);
    new bootstrap.Modal('#modal').show();
  }
  function object2ini(data, parentKey = '') {
    return Object.entries(data).map(([key, value]) => {
      if (typeof value === 'object') {
        return object2ini(value, `${parentKey}${key}.`);
      }
      return `${parentKey}${key}=${value}`;
    }).join('\n');
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('error', () => {
        console.error(`Error occurred reading file: ${file.name}`);
        reject(`Error occurred reading file: ${file.name}`);
      });
      reader.addEventListener('load', (event) => {
        resolve(event.target.result);
      });
      reader.readAsText(file);
    });
  }
  function htmlEncode(str) {
    if (str.length === 0) {
      return '';
    }
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;');
  }
  function htmlDecode(str) {
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
