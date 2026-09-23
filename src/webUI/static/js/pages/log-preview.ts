/**
 * @file src/webUI/static/js/pages/log-preview.ts
 * @description 提供需要在线身份验证的日志预览，按固定大小分页读取任意大小的文件。
 */
(() => {
  let active: (() => void) | undefined;
  const openLogPreview = (scope: string, secret: string): void => {
    active?.();
    const dialog = document.createElement('dialog');
    dialog.className = 'log-preview';
    dialog.setAttribute('aria-labelledby', 'log-preview-title');
    const header = document.createElement('header');
    header.className = 'log-preview__header';
    const title = document.createElement('h3');
    title.id = 'log-preview-title';
    title.textContent = __('logPreview');
    const badge = document.createElement('span');
    badge.className = 'log-preview__scope';
    badge.textContent = scope;
    header.append(title, badge);
    const controls = document.createElement('div');
    controls.className = 'log-preview__controls';
    const status = document.createElement('p');
    status.className = 'log-preview__status';
    status.setAttribute('role', 'status');
    const body = document.createElement('pre');
    body.className = 'log-preview__body';
    body.tabIndex = 0;
    body.setAttribute('aria-label', __('logPreview'));
    const button = (label: string, callback: () => void): HTMLButtonElement => {
      const item = document.createElement('button');
      item.type = 'button'; item.textContent = __(label);
      item.className = 'log-preview__button';
      item.addEventListener('click', callback); controls.append(item); return item;
    };
    let cursor: string | undefined;
    let closed = false;
    let request: AbortController | undefined;
    const headers = {
      Authorization: `Bearer ${secret}`
    };
    const loadPage = async (older = false): Promise<void> => {
      request?.abort();
      const current = new AbortController(); request = current;
      previous.disabled = true;
      dialog.dataset.state = 'loading';
      body.setAttribute('aria-busy', 'true');
      status.textContent = __('logLoading');
      try {
        const query = older && cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const response = await fetch(`/api/logs/${scope}/page${query}`, {
          headers,
          signal: current.signal
        });
        if (!response.ok) {
          throw new Error();
        }
        const page = await response.json() as {
          text: string;
          older?: string;
          reset: boolean;
          missing: boolean
        };
        if (closed || request !== current) {
          return;
        }
        body.textContent = page.text;
        cursor = page.older;
        previous.disabled = !cursor;
        const message = page.missing ? __('logEmpty') : __('logPageLimit');
        dialog.dataset.state = page.missing || !page.text ? 'empty' : 'ready';
        status.textContent = page.reset ? __('logRotated') : message;
        body.scrollTop = older ? 0 : body.scrollHeight;
      } catch (_error) {
        if (!closed && !current.signal.aborted) {
          dialog.dataset.state = 'error';
          status.textContent = __('logReadFailed');
          previous.disabled = !cursor;
        }
      } finally {
        if (!closed && request === current) {
          body.setAttribute('aria-busy', 'false');
        }
      }
    };
    const previous = button('logOlder', () => {
      void loadPage(true);
    });
    const latest = button('logLatest', () => {
      void loadPage();
    });
    latest.classList.add('log-preview__button--primary');
    const close = (): void => {
      if (closed) {
        return;
      }
      closed = true; request?.abort();
      dialog.remove(); if (active === close) {
        active = undefined;
      }
    };
    const dismiss = button('logClose', close);
    dismiss.classList.add('log-preview__button--close');
    dialog.addEventListener('cancel', close);
    dialog.addEventListener('close', close);
    dialog.append(header, controls, body, status); document.body.append(dialog);
    active = close; dialog.showModal(); void loadPage();
  };
  Object.assign(globalThis, {
    openLogPreview
  });
})();
