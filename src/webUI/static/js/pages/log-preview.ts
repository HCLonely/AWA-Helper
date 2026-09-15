/** Online-only authenticated preview with fixed-size pages for files of any size. */
(() => {
  let active: (() => void) | undefined;
  const openLogPreview = (scope: string, secret: string): void => {
    active?.();
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:90vw;max-width:1100px;height:80vh;padding:16px;color:#1f2937;background:#fff;';
    const title = document.createElement('h3');
    title.textContent = `${scope} — ${__('logPreview')}`;
    const controls = document.createElement('div');
    const status = document.createElement('p');
    const body = document.createElement('pre');
    body.style.cssText = 'height:60vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;';
    const button = (label: string, callback: () => void): HTMLButtonElement => {
      const item = document.createElement('button');
      item.type = 'button'; item.textContent = __(label); item.style.marginRight = '8px';
      item.addEventListener('click', callback); controls.append(item); return item;
    };
    let cursor: string | undefined;
    let closed = false;
    let request: AbortController | undefined;
    const headers = { Authorization: `Bearer ${secret}` };
    const loadPage = async (older = false): Promise<void> => {
      request?.abort();
      const current = new AbortController(); request = current;
      previous.disabled = true;
      status.textContent = __('logLoading');
      try {
        const query = older && cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const response = await fetch(`/api/logs/${scope}/page${query}`, { headers, signal: current.signal });
        if (!response.ok) {
          throw new Error();
        }
        const page = await response.json() as { text: string; older?: string; reset: boolean; missing: boolean };
        if (closed || request !== current) {
          return;
        }
        body.textContent = page.text;
        cursor = page.older;
        previous.disabled = !cursor;
        const message = page.missing ? __('logEmpty') : __('logPageLimit');
        status.textContent = page.reset ? __('logRotated') : message;
        body.scrollTop = older ? 0 : body.scrollHeight;
      } catch (_error) {
        if (!closed && !current.signal.aborted) {
          status.textContent = __('logReadFailed');
        }
      }
    };
    const previous = button('logOlder', () => {
      void loadPage(true);
    });
    button('logLatest', () => {
      void loadPage();
    });
    const close = (): void => {
      if (closed) {
        return;
      }
      closed = true; request?.abort();
      dialog.remove(); if (active === close) {
        active = undefined;
      }
    };
    button('logClose', close);
    dialog.addEventListener('cancel', close);
    dialog.addEventListener('close', close);
    dialog.append(title, controls, status, body); document.body.append(dialog);
    active = close; dialog.showModal(); void loadPage();
  };
  Object.assign(globalThis, { openLogPreview });
})();
