/** 管理器首页的社区活动编辑器；数据独立于 YAML 配置持久化。 */
(async () => {
  if (typeof ManagerAuth !== 'undefined' && !await ManagerAuth.ready) {
    return;
  }
  const form = document.querySelector<HTMLFormElement>('#community-event-form');
  if (!form) {
    return;
  }
  const fields = document.querySelector<HTMLFieldSetElement>('#community-event-fields')!;
  const source = document.querySelector<HTMLSelectElement>('#community-event-source')!;
  const gameId = document.querySelector<HTMLInputElement>('#community-event-id')!;
  const gameName = document.querySelector<HTMLInputElement>('#community-event-name')!;
  const updated = document.querySelector<HTMLOutputElement>('#community-event-updated')!;
  const status = document.querySelector<HTMLElement>('#community-event-status')!;
  const sync = document.querySelector<HTMLButtonElement>('#community-event-sync')!;
  const reload = document.querySelector<HTMLButtonElement>('#community-event-reload')!;
  let busy = false;
  let loaded = false;
  let enabled = false;
  const headers = (): { Authorization: string } => ({
    Authorization: `Bearer ${sessionStorage.getItem('managerServerSecret') || ''}`
  });
  const setBusy = (value: boolean): void => {
    busy = value;
    fields.disabled = busy || !loaded;
    sync.disabled = busy || !enabled;
    reload.disabled = busy;
    form.setAttribute('aria-busy', String(value));
  };
  const showError = (error: unknown): void => {
    const response = error as { response?: { data?: { error?: string } }; message?: string };
    status.textContent = __(response.response?.data?.error || response.message || 'communityEventReadFailed');
  };
  const fill = (data: { sourceUrl: string; gameId: string; gameName?: string; updateTime: string }): void => {
    source.value = data.sourceUrl;
    gameId.value = data.gameId;
    gameName.value = data.gameName || '';
    updated.value = data.updateTime || '—';
  };
  const load = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    status.textContent = __('communityEventLoading');
    try {
      const response = await axios.get('/api/community-event', {
        headers: headers()
      });
      fill(response.data.data);
      loaded = true;
      enabled = response.data.enabled === true;
      const validity = response.data.valid ? 'communityEventCurrent' : 'communityEventDataRequired';
      status.textContent = __(!enabled ? 'communityEventDisabled' : validity);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !loaded || !form.reportValidity()) {
      return;
    }
    setBusy(true);
    status.textContent = __('communityEventSaving');
    try {
      const response = await axios.put('/api/community-event', {
        sourceUrl: source.value,
        gameId: gameId.value.trim(),
        gameName: gameName.value.trim()
      }, {
        headers: headers()
      });
      fill(response.data);
      status.textContent = __('communityEventSaved');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  });
  sync.addEventListener('click', async () => {
    if (busy || !loaded || !enabled) {
      return;
    }
    setBusy(true);
    status.textContent = __('communityEventSyncing');
    try {
      const response = await axios.post('/api/community-event/sync', {
        sourceUrl: source.value
      }, {
        headers: headers()
      });
      fill(response.data);
      status.textContent = __('communityEventSynced');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  });
  reload.addEventListener('click', () => {
    void load();
  });
  await load();
})();
