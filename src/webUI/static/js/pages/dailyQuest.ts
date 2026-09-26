/**
 * @file src/webUI/static/js/pages/dailyQuest.ts
 * @description 展示每日任务状态与实时日志。
 */
(async () => {
  if (typeof ManagerAuth !== 'undefined' && !await ManagerAuth.ready) {
    return;
  }
  type QuestField = string | number;
  interface QuestInfo {
    link?: string;
    [key: string]: QuestField | undefined;
  }
  type QuestData = Record<string, QuestInfo>;
  interface WebUIMessage {
    type?: string;
    scope?: string;
    id?: string | number;
    data?: QuestData | string;
    [key: string]: unknown;
  }
  const display = (value: QuestField | undefined): QuestField => value ?? '';
  const displayARP = (value: QuestField | undefined): QuestField => {
    const arp = parseInt(String(value ?? ''), 10);
    return Number.isNaN(arp) ? display(value) : arp;
  };
  const isTargetReached = (current: QuestField | undefined, target: QuestField | undefined): boolean => {
    const currentValue = parseFloat(String(current ?? ''));
    const targetValue = parseFloat(String(target ?? ''));
    return !Number.isNaN(currentValue) && !Number.isNaN(targetValue) && currentValue >= targetValue;
  };

  function __(text: string, ...argv: string[]): string {
    let result = text;
    if (I18n[lang]?.[text]) {
      result = I18n[lang][text];
      if (argv.length > 0) {
        argv.forEach((s) => {
          result = result.replace(/%s/, s);
        });
      }
    }
    return result;
  }
  function generateTaskInfo(data?: QuestData): void {
    if (data) {
      Object.entries(data).filter(([name]) => name.includes(__('dailyTask', ''))).forEach(([name, value], index) => {
        if (value.link) {
          try {
            const link = new URL(value.link, window.location.href);
            if (!['http:', 'https:'].includes(link.protocol)) {
              throw new Error('Unsupported protocol');
            }
            const anchor = dom('<a>').attr({
              href: link.href,
              target: '_blank',
              rel: 'noopener noreferrer'
            }).css('border', 'none')
              .text(name);
            dom(`#daily-quest-${index}`).find('th').empty()
              .append(anchor);
          } catch (_error) {
            dom(`#daily-quest-${index}`).find('th').text(name);
          }
        } else {
          dom(`#daily-quest-${index}`).find('th').text(name);
        }
        dom(`#daily-quest-${index}`).find('td').eq(0)
          .text(display(value[__('status')]));
        dom(`#daily-quest-${index}`).find('td').eq(1)
          .text(displayARP(value[__('obtainedARP')]));
        dom(`#daily-quest-${index}`).find('td').eq(2)
          .text(display(value[__('maxAvailableARP')]));
        dom(`#daily-quest-${index}`).show();

        if (Number(displayARP(value[__('obtainedARP')])) > 0) {
          dom(`#daily-quest-${index}`).attr('class', 'table-success');
        }
      });
      Object.entries(data).filter(([name]) => name.includes(__('steamQuest'))).forEach(([name, value], index) => {
        dom(`#steam-quest-${index}`).find('th').text(name);
        dom(`#steam-quest-${index}`).find('td').eq(0)
          .text(display(value[__('status')]));
        dom(`#steam-quest-${index}`).find('td').eq(1)
          .text(display(value[__('obtainedARP')]));
        dom(`#steam-quest-${index}`).find('td').eq(2)
          .text(display(value[__('maxAvailableARP')]));
        dom(`#steam-quest-${index}`).show();

        if (value[__('status')] === __('done')) {
          dom(`#steam-quest-${index}`).attr('class', 'table-success');
        }
      });

      dom('#time-on-site').find('td').eq(0)
        .text(display(data[__('timeOnSite')][__('status')]));
      dom('#time-on-site').find('td').eq(1)
        .text(display(data[__('timeOnSite')][__('obtainedARP')]));
      dom('#time-on-site').find('td').eq(2)
        .text(display(data[__('timeOnSite')][__('maxAvailableARP')]));
      dom('#watch-twitch').find('td').eq(0)
        .text(display(data[__('watchTwitch')][__('status')]));
      dom('#watch-twitch').find('td').eq(1)
        .text(parseInt(String(data[__('watchTwitch')][__('obtainedARP')]), 10) + parseInt(String(data[__('watchTwitch')][__('extraARP')]), 10));
      dom('#watch-twitch').find('td').eq(2)
        .text(display(data[__('watchTwitch')][__('maxAvailableARP')]));
      if (isTargetReached(data[__('timeOnSite')][__('obtainedARP')], data[__('timeOnSite')][__('maxAvailableARP')])) {
        dom('#time-on-site').attr('class', 'table-success');
      }
      const twitchARP = parseFloat(String(data[__('watchTwitch')][__('obtainedARP')])) +
        parseFloat(String(data[__('watchTwitch')][__('extraARP')]));
      if (data[__('watchTwitch')][__('status')] === __('done') ||
        isTargetReached(twitchARP, data[__('watchTwitch')][__('maxAvailableARP')])) {
        dom('#watch-twitch').attr('class', 'table-success');
      }
      document.querySelectorAll('[data-community-event-row]').forEach((row) => row.remove());
      const template = document.getElementById('steam-event');
      if (template) {
        template.style.display = 'none';
        let previousRow = template;
        Object.entries(data).filter(([name]) => name === __('steamCommunityEvent') || name.startsWith(`${__('steamCommunityEvent')}[`)).forEach(([name, value], index) => {
          const row = template.cloneNode(true) as HTMLElement;
          row.id = `steam-event-${index}`;
          row.dataset.communityEventRow = '';
          row.style.display = '';
          row.querySelector('th')!.textContent = name;
          const cells = row.querySelectorAll('td');
          cells[0].textContent = String(display(value[__('status')]));
          cells[1].textContent = `${value[__('obtainedARP')]}min`;
          cells[2].textContent = String(display(value[__('maxAvailableARP')]));
          cells.forEach((cell) => {
            cell.className = ''; cell.removeAttribute('data-i18n');
          });
          row.className = value[__('status')] === __('done') || (parseFloat(String(value[__('maxAvailableARP')])) > 0 &&
            isTargetReached(value[__('obtainedARP')], value[__('maxAvailableARP')])) ? 'table-success' : '';
          previousRow.after(row);
          previousRow = row;
        });
      }
      if (data[__('battlePass')]) {
        const battlePass = data[__('battlePass')];
        dom('#battle-pass').find('td').eq(0)
          .text(display(battlePass[__('status')]));
        dom('#battle-pass').find('td').eq(1)
          .text(display(battlePass[__('obtainedARP')]));
        dom('#battle-pass').find('td').eq(2)
          .text(display(battlePass[__('maxAvailableARP')]));
        const hasTokenTarget = Number(battlePass[__('maxAvailableARP')]) > 0;
        dom('#battle-pass').attr('class', (hasTokenTarget && isTargetReached(
          battlePass[__('obtainedARP')], battlePass[__('maxAvailableARP')]
        )) || battlePass[__('status')] === __('battlePassStatus_completed') ? 'table-success' : '')
          .show();
      }
      return;
    }
    dom('#table-head').find('th').eq(1)
      .text(__('status'));
    dom('#table-head').find('th').eq(2)
      .text(__('obtainedARP'));
    dom('#table-head').find('th').eq(3)
      .text(__('maxAvailableARP'));
    dom('#daily-quest-0').find('th').text(__('dailyTask', ''));
    dom('#time-on-site').find('th').text(__('timeOnSite'));
    dom('#watch-twitch').find('th').text(__('watchTwitch'));
    dom('#battle-pass').find('th').text(__('battlePass'));
    dom('#steam-event').find('th').text(__('steamCommunityEvent'));
    dom('#log-title').text(__('log'));
  }
  function time() {
    return `<font class="gray">[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] </font>`;
  }
  const webUIReconnectInitialDelay = 1000;
  const webUIReconnectMaxDelay = 30000;
  let webUISocket: WebSocket | undefined;
  let webUIReconnectTimer: number | undefined;
  let webUIReconnectAttempts = 0;

  const pendingLogs = new Map<number, string>();
  let pendingSize = 0;
  let logFrame: number | undefined;
  function flushLogView(): void {
    logFrame = undefined;
    if (document.hidden) {
      return;
    }
    const area = document.getElementById('log-area');
    if (!area) {
      return;
    }
    const follow = area.getBoundingClientRect().bottom <= window.innerHeight + 48;
    const added = document.createDocumentFragment();
    for (const [id, html] of pendingLogs) {
      const existing = document.getElementById(`log-${id}`);
      if (existing) {
        dom(existing).html(html);
      } else {
        const item = document.createElement('li');
        item.id = `log-${id}`;
        item.innerHTML = html;
        added.append(item);
      }
    }
    // 仅统计发生变化的节点，避免重新扫描整个日志区域。
    dom(area).append(dom(Array.from(added.children)));
    pendingLogs.clear();
    pendingSize = 0;
    if (follow) {
      area.lastElementChild?.scrollIntoView();
    }
  }
  function queueLog(id: number, html: string): void {
    pendingSize += html.length - (pendingLogs.get(id)?.length ?? 0);
    pendingLogs.set(id, html);
    while (pendingLogs.size > 1000 || pendingSize > 256 * 1024) {
      const oldest = pendingLogs.keys().next().value!;
      pendingSize -= pendingLogs.get(oldest)!.length;
      pendingLogs.delete(oldest);
    }
    if (logFrame === undefined && !document.hidden) {
      logFrame = requestAnimationFrame(flushLogView);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && logFrame === undefined && pendingLogs.size) {
      logFrame = requestAnimationFrame(flushLogView);
    }
  });

  function scheduleWebUIReconnect(ws: WebSocket): void {
    if (ws !== webUISocket || webUIReconnectTimer) {
      return;
    }
    const delay = Math.min(
      webUIReconnectInitialDelay * (2 ** Math.min(webUIReconnectAttempts, 5)),
      webUIReconnectMaxDelay
    );
    webUIReconnectAttempts += 1;
    dom('#log-area').append(`<li>${time()}<font class="blue">${__('reconnectingWebUI')}</font></li>`);
    webUIReconnectTimer = window.setTimeout(() => {
      webUIReconnectTimer = undefined;
      connectWebUIServer();
    }, delay);
  }

  function connectWebUIServer(): void {
    dom('#log-area').append(`<li>${time()}${__('connectingWebUI')}</li>`);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let wsPort = '';
    if (window.location.host === window.location.hostname) {
      wsPort = window.location.protocol === 'https:' ? ':443' : ':80';
    }

    let protocols;
    const managerSecret = sessionStorage.getItem('managerServerSecret') || localStorage.getItem('managerServerSecret');
    if (managerSecret) {
      const bytes = new TextEncoder().encode(managerSecret);
      let binary = '';
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      const encodedSecret = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
        .replace(/=+$/, '');
      protocols = ['awa-manager', encodedSecret];
    }
    const wsUrl = `${wsProtocol}://${window.location.host}${wsPort}/ws?scope=dailyQuest&replay=chunks`;
    const ws = protocols ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);
    webUISocket = ws;
    ws.onopen = function () {
      if (ws !== webUISocket) {
        return;
      }
      console.log(__('connectWebUISuccess'));
      dom('#log-area').html('');
      pendingLogs.clear();
      pendingSize = 0;
      webUIReconnectAttempts = 0;
    };
    ws.onclose = function () {
      if (typeof ManagerAuth !== 'undefined') {
        void ManagerAuth.verify().catch(() => {});
      }
      if (ws !== webUISocket) {
        return;
      }
      console.log(__('WebUIClosed'));
      dom('#log-area').append(`<li>${time()}<font class="yellow">${__('WebUIClosed')}</li>`);
      scheduleWebUIReconnect(ws);
    };
    ws.onerror = function () {
      scheduleWebUIReconnect(ws);
    };
    ws.onmessage = function (e) {
      if (ws !== webUISocket) {
        return;
      }
      const data = JSON.parse(String(e.data)) as WebUIMessage;
      if (data.type === 'logs') {
        for (const value of Object.values(data) as WebUIMessage[]) {
          if (!value || typeof value !== 'object' || value.scope !== 'dailyQuest') {
            continue;
          }
          if (value.type === 'questInfo') {
            generateTaskInfo(value.data as QuestData);
            continue;
          }
          queueLog(value.id as number, String(value.data ?? ''));
        }
      } else if (data.type === 'log' && data.scope === 'dailyQuest') {
        queueLog(data.id as number, String(data.data ?? ''));
      } else if (data.type === 'questInfo' && data.scope === 'dailyQuest') {
        generateTaskInfo(data.data as QuestData);
      }
    };
  }
  document.documentElement.lang = lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    element.textContent = __(element.dataset.i18n!);
  });
  connectWebUIServer();
  generateTaskInfo();
})();
