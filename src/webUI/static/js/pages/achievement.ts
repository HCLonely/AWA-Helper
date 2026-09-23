/**
 * @file src/webUI/static/js/pages/achievement.ts
 * @description 控制并展示由 Manager 管理的成就任务。
 */
(async () => {
  if (typeof ManagerAuth !== 'undefined' && !await ManagerAuth.ready) {
    return;
  }
  interface AchievementState {
    status: string;
    message?: string;
  }

  const requiredElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing required element: ${selector}`);
    }
    return element;
  };

  const getSecret = () => sessionStorage.getItem('managerServerSecret') || localStorage.getItem('managerServerSecret') || '';
  const headers = () => ({
    Authorization: `Bearer ${getSecret()}`,
    'Content-Type': 'application/json'
  });

  async function refreshAchievement() {
    const response = await fetch('/api/jobs/achievement', {
      headers: headers()
    });
    const state: AchievementState = response.ok ? await response.json() : {
      status: 'unauthorized',
      message: 'Configure Manager Secret on the dashboard.'
    };
    requiredElement('#achievement-status').textContent = state.status;
    requiredElement('#achievement-message').textContent = state.message || '';
  }

  requiredElement('#achievement-start').addEventListener('click', async () => {
    await fetch('/api/jobs/achievement/start', {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    await refreshAchievement();
  });
  requiredElement('#achievement-stop').addEventListener('click', async () => {
    await fetch('/api/jobs/achievement/stop', {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    await refreshAchievement();
  });
  requiredElement('#achievement-refresh').addEventListener('click', refreshAchievement);
  requiredElement('#achievement-logs').addEventListener('click', async () => {
    openLogPreview('achievement', getSecret());
  });
  void refreshAchievement();
})();
