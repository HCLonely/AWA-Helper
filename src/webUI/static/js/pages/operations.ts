/* Manager history, schedule preview and read-only connection diagnostics. */
(() => {
  const root = document.querySelector<HTMLElement>('#operations');
  if (!root) {
    return;
  }
  const t = (zh: string, en: string): string => (lang === 'en' ? en : zh);
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.title = `${t('运行记录与诊断', 'Run history & diagnostics')} · AWA Helper`;
  if (lang === 'en') {
    document.querySelectorAll<HTMLElement>('[data-en]').forEach((element) => {
      element.textContent = element.dataset.en!;
    });
  }
  const status = document.querySelector<HTMLElement>('#operations-status')!;
  const headers = (): Record<string, string> => {
    const secret = sessionStorage.getItem('managerServerSecret') || localStorage.getItem('managerServerSecret');
    document.getElementById('auth-hint')!.hidden = Boolean(secret);
    if (!secret) {
      throw new Error(t('请先配置 Manager 密钥', 'Configure the Manager secret first'));
    }
    return { Authorization: `Bearer ${secret}` };
  };
  const displayTime = (value?: string, timezone?: string): string => (value
    ? new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', timezone ? { timeZone: timezone } : {}) : '—');
  const label = (value: string): string => ({
    manual: t('手动', 'Manual'), schedule: t('定时', 'Scheduled'), once: t('单次', 'One-shot'),
    running: t('运行中', 'Running'), stopping: t('停止中', 'Stopping'), completed: t('完成', 'Completed'), failed: t('失败', 'Failed'),
    interrupted: t('中断', 'Interrupted'), cancelled: t('取消', 'Cancelled'), skipped: t('跳过', 'Skipped'), partial: t('部分完成', 'Partial')
  } as Record<string, string>)[value] || value;

  function table(container: HTMLElement, titles: string[], rows: string[][]): void {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = t('暂无记录', 'No records'); container.append(empty); return;
    }
    const element = document.createElement('table');
    const head = element.createTHead().insertRow();
    titles.forEach((title) => {
      const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; head.append(cell);
    });
    const body = element.createTBody();
    rows.forEach((values) => {
      const row = body.insertRow(); values.forEach((value, index) => {
        const cell = row.insertCell();
        if (index === 1 && container.id === 'run-history') {
          cell.append(badge(value));
        } else {
          cell.textContent = value;
        }
      });
    });
    container.append(element);
  }

  function badge(value: string, tone?: string): HTMLElement {
    const element = document.createElement('span'); element.className = 'badge'; element.textContent = value;
    const tones: Record<string, string> = { [label('completed')]: 'good', [label('failed')]: 'bad', [label('interrupted')]: 'bad', [label('running')]: 'active', [label('stopping')]: 'active', [label('partial')]: 'warn' };
    element.dataset.tone = tone || tones[value] || 'neutral';
    return element;
  }
  function card(container: HTMLElement, title: string, state: string, tone: string, description: string): HTMLElement {
    const element = document.createElement('article'); element.className = 'record-card';
    const head = document.createElement('div'); head.className = 'record-head';
    const name = document.createElement('strong'); name.textContent = title; head.append(name, badge(state, tone));
    const body = document.createElement('p'); body.textContent = description; element.append(head, body); container.append(element); return element;
  }
  function metric(id: string, value: number): void {
 document.getElementById(id)!.textContent = String(value);
  }

  type Run = { name: string; source: string; status: string; startedAt: string; finishedAt?: string; message?: string;
    steps: Array<{ name: string; status: string; message?: string }> };
  type Schedule = { name: string; cron: string; timezone: string; active: boolean; nextRuns: string[] };
  type Check = { platform: string; code: string; checkedAt: string; retryAt?: string; parser?: string; missingFields?: string[] };

  async function refresh(): Promise<void> {
    const auth = headers();
    const results = await Promise.allSettled([
      axios.get<{ runs: Run[]; failures: Record<string, number>; storageError?: string }>('/api/history', { headers: auth }),
      axios.get<{ schedules: Schedule[] }>('/api/schedules', { headers: auth })
    ]);
    const problems: string[] = [];
    const [history, schedules] = results;
    if (history.status === 'fulfilled') {
      const { runs } = history.value.data;
      metric('metric-total', runs.length);
      metric('metric-running', runs.filter((run) => ['running', 'stopping'].includes(run.status)).length);
      metric('metric-attention', runs.filter((run) => ['failed', 'interrupted', 'partial'].includes(run.status)).length);
      table(document.querySelector<HTMLElement>('#run-history')!, [t('任务 / 来源', 'Job / source'), t('状态', 'Status'), t('开始 → 结束（本地时间）', 'Start → end (local time)'), t('子任务 / 原因', 'Steps / reason')],
        history.value.data.runs.map((run) => [`${run.name} / ${label(run.source)}`, label(run.status), `${displayTime(run.startedAt)} → ${displayTime(run.finishedAt)}`,
          [run.message, ...run.steps.map((step) => `${step.name}: ${label(step.status)}${step.message ? ` (${step.message})` : ''}`)].filter(Boolean).join('\n')]));
      document.querySelector<HTMLElement>('#run-failures')!.textContent = `${t('连续失败（保留记录内）', 'Consecutive failures (retained runs)')}: ${
        Object.entries(history.value.data.failures).map(([name, count]) => `${name}: ${count}`).join(' · ') || t('无', 'None')}`;
      if (history.value.data.storageError) {
        problems.push(history.value.data.storageError);
      }
    } else {
      problems.push((history.reason as { response?: { status?: number } }).response?.status === 401 ? t('密钥无效，请在管理首页重新配置', 'Invalid secret; update it on the Manager home page') : t('历史读取失败', 'Unable to load history'));
    }
    if (schedules.status === 'fulfilled') {
      const items = schedules.value.data.schedules;
      metric('metric-schedules', items.filter((item) => item.active).length);
      const container = document.querySelector<HTMLElement>('#schedule-list')!; container.replaceChildren();
      if (!items.length) {
        table(container, [], []);
      }
      items.forEach((item) => {
        const element = card(container, item.name, item.active ? t('已启用', 'Active') : t('未启用', 'Inactive'), item.active ? 'active' : 'neutral',
          `${describe(item.cron)}\n${item.cron} · ${item.timezone}`);
        const upcoming = document.createElement('p'); upcoming.textContent = t('未来五次执行（计划时区）', 'Next five runs (schedule timezone)'); element.append(upcoming);
        const list = document.createElement('ol'); item.nextRuns.forEach((time) => {
          const entry = document.createElement('li'); entry.textContent = displayTime(time, item.timezone); list.append(entry);
        }); element.append(list);
      });
    } else {
      problems.push(t('计划读取失败', 'Unable to load schedules'));
    }
    if (problems.length) {
      throw new Error(problems.join('\n'));
    }
  }

  function describe(expression: string): string {
    const fields = expression.trim().split(/\s+/);
    const parts = fields.length === 5 ? ['0', ...fields] : fields;
    const [second, minute, hour, day, month, weekday] = parts;
    if (parts.length === 6 && day === '*' && month === '*' && weekday === '*' && /^\d+$/.test(hour) && /^\d+$/.test(minute) && /^\d+$/.test(second)) {
      return `${t('每天', 'Every day at')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }
    if (parts.length === 6 && second === '0' && /^\*\/\d+$/.test(minute) && [hour, day, month, weekday].every((field) => field === '*')) {
      return t(`每 ${minute.slice(2)} 分钟（每小时重新计数）`, `Every ${minute.slice(2)} minutes, resetting each hour`);
    }
    return t('按指定的秒、分、时、日、月、星期字段匹配；执行时间见预览', 'Matches the specified second, minute, hour, day, month and weekday; see the preview');
  }

  const advice: Record<string, string> = {
    ok: t('连接正常', 'Connection verified'), disabled: t('该任务未启用', 'Task disabled'),
    'missing-config': t('补全该平台的 Cookie 或连接参数', 'Complete this platform’s cookies or connection settings'),
    'session-expired': t('重新同步 Cookie；ASF 请检查 IPC 密码', 'Resync cookies; for ASF check the IPC password'),
    'extension-missing': t('为 Twitch 的 Arena Rewards Tracker 扩展授权', 'Authorize the Arena Rewards Tracker Twitch extension'),
    'network-rejected': t('AWA 拒绝当前网络，请检查代理或网络出口', 'AWA rejected this network; check the proxy or network connection'),
    'rate-limited': t('远端限流，请等到下列时间再重试', 'Rate limited; wait until the time below before retrying'),
    'page-changed': t('页面或响应结构无法识别，请导出诊断并检查项目更新', 'Unrecognized page or response; export diagnostics and check for an update'),
    'connection-failed': t('检查网络、代理及服务地址；ASF 还需检查端口和 IPC 密码', 'Check the network, proxy and service address; for ASF also check the port and IPC password')
  };

  const actions: Record<string, () => Promise<void>> = {
    refresh,
    diagnose: async () => {
      const response = await axios.post<{ checks: Check[] }>('/api/diagnostics', {}, { headers: headers(), timeout: 25000 });
      const container = document.querySelector<HTMLElement>('#diagnostic-results')!; container.replaceChildren();
      if (!response.data.checks.length) {
        table(container, [], []);
      }
      response.data.checks.forEach((check) => {
        const states: Record<string, [string, string]> = { ok: [t('连接正常', 'Connected'), 'good'], disabled: [t('未启用', 'Disabled'), 'neutral'] };
        const [state, tone] = states[check.code] || [t('需要处理', 'Needs attention'), 'warn'];
        card(container, check.platform.toUpperCase(), state, tone,
          [advice[check.code] || check.code, check.retryAt ? displayTime(check.retryAt) : '', check.parser, check.missingFields?.join(', '), `${t('检查时间', 'Checked at')}: ${displayTime(check.checkedAt)}`].filter(Boolean).join('\n'));
      });
    },
    export: async () => {
      const response = await axios.get('/api/diagnostics/export', { headers: headers(), responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = 'awa-diagnostics.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    preview: async () => {
      const cron = document.querySelector<HTMLInputElement>('#schedule-cron')!.value;
      const timezone = document.querySelector<HTMLInputElement>('#schedule-timezone')!.value;
      const response = await axios.post<{ nextRuns: string[] }>('/api/schedules/preview', { cron, timezone }, { headers: headers() });
      document.querySelector<HTMLElement>('#schedule-preview')!.textContent = `${describe(cron)} · ${timezone}\n${response.data.nextRuns.map((time) => displayTime(time, timezone)).join('\n')}`;
    }
  };
  root.querySelectorAll<HTMLButtonElement>('[data-operation]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true; status.dataset.state = 'loading'; status.textContent = t('处理中…', 'Working…');
    try {
      await actions[button.dataset.operation!](); status.dataset.state = 'success'; status.textContent = t('已完成', 'Done');
    } catch (error) {
      status.dataset.state = 'error';
      const code = (error as { response?: { status?: number } }).response?.status;
      if (code === 401) {
        status.textContent = t('密钥无效，请重新配置', 'Invalid secret; update it');
      } else if (code === 400) {
        status.textContent = t('Cron 或时区无效', 'Invalid cron or timezone');
      } else {
        status.textContent = error instanceof Error ? error.message : t('操作失败', 'Operation failed');
      }
    } finally {
      button.disabled = false;
    }
  }));
  document.querySelector<HTMLInputElement>('#schedule-timezone')!.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (sessionStorage.getItem('managerServerSecret') || localStorage.getItem('managerServerSecret')) {
    root.querySelector<HTMLButtonElement>('[data-operation=refresh]')!.click();
  } else {
    document.getElementById('auth-hint')!.hidden = false;
  }
})();
