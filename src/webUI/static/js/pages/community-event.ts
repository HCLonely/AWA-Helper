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
  const games = document.querySelector<HTMLElement>('#community-event-games')!;
  const add = document.querySelector<HTMLButtonElement>('#community-event-add')!;
  const empty = document.querySelector<HTMLElement>('#community-event-empty')!;
  type Game = { gameId: string; gameName?: string; eventPath?: string; updateTime?: string };
  let sequence = 0;
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
  const addGame = (game: Partial<Game> = {}, focus = false): void => {
    const number = ++sequence;
    const row = document.createElement('fieldset');
    row.className = 'community-event-game';
    const legend = document.createElement('legend');
    legend.textContent = `${__('communityEventGame')} ${number}`;
    row.append(legend);
    const grid = document.createElement('div');
    grid.className = 'community-event-grid';
    for (const [key, translation] of [['gameId', 'communityEventGameId'], ['gameName', 'communityEventGameName'], ['eventPath', 'communityEventPath']] as const) {
      const group = document.createElement('div');
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = `community-event-${key}-${number}`;
      input.name = key;
      input.className = 'form-control';
      input.type = 'text';
      input.value = game[key] || '';
      label.htmlFor = input.id;
      label.textContent = __(translation);
      if (key === 'gameId') {
        input.required = true;
        input.inputMode = 'numeric';
        input.pattern = '[1-9][0-9]*';
      } else if (key === 'eventPath') {
        input.pattern = '[a-z0-9-]+';
      }
      group.append(label, input);
      grid.append(group);
    }
    const footer = document.createElement('div');
    footer.className = 'community-event-game-footer';
    const timestamp = document.createElement('p');
    timestamp.className = 'community-event-hint';
    timestamp.textContent = `${__('communityEventUpdateTime')}: ${game.updateTime || '—'}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-outline-primary';
    remove.textContent = __('communityEventRemove');
    remove.setAttribute('aria-label', `${__('communityEventRemove')} ${number}`);
    remove.addEventListener('click', () => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      empty.hidden = games.children.length > 0;
      (next?.querySelector<HTMLInputElement>('input') || add).focus();
    });
    footer.append(timestamp, remove);
    row.append(grid, footer);
    games.append(row);
    empty.hidden = true;
    if (focus) {
      row.querySelector<HTMLInputElement>('input')?.focus();
    }
  };
  const fill = (data: { sourceUrl: string; games?: Game[] } & Partial<Game>): void => {
    source.value = data.sourceUrl;
    games.replaceChildren();
    sequence = 0;
    const entries = data.games ?? (data.gameId ? [data as Game] : []);
    entries.forEach((game) => addGame(game));
    empty.hidden = entries.length > 0;
  };
  const readGames = (): Game[] => Array.from(games.querySelectorAll<HTMLElement>('.community-event-game')).map((row) => ({
    gameId: row.querySelector<HTMLInputElement>('[name="gameId"]')!.value.trim(),
    gameName: row.querySelector<HTMLInputElement>('[name="gameName"]')!.value.trim(),
    eventPath: row.querySelector<HTMLInputElement>('[name="eventPath"]')!.value.trim()
  }));
  add.addEventListener('click', () => {
    if (!busy && loaded) {
      addGame({}, true);
    }
  });
  games.addEventListener('input', () => {
    games.querySelectorAll<HTMLInputElement>('input').forEach((input) => input.setCustomValidity(''));
  });
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
    if (busy || !loaded) {
      return;
    }
    games.querySelectorAll<HTMLInputElement>('input').forEach((input) => input.setCustomValidity(''));
    if (!form.reportValidity()) {
      return;
    }
    const entries = readGames();
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      if (ids.has(entry.gameId) || (entry.eventPath && paths.has(entry.eventPath))) {
        const name = ids.has(entry.gameId) ? 'gameId' : 'eventPath';
        const input = games.children[index].querySelector<HTMLInputElement>(`[name="${name}"]`)!;
        input.setCustomValidity(__('communityEventDuplicate'));
        input.reportValidity();
        input.focus();
        return;
      }
      ids.add(entry.gameId);
      if (entry.eventPath) {
        paths.add(entry.eventPath);
      }
    }
    setBusy(true);
    status.textContent = __('communityEventSaving');
    try {
      const response = await axios.put('/api/community-event', {
        sourceUrl: source.value,
        games: entries
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
