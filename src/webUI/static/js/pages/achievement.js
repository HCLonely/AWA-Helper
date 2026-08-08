/** @description Controls and renders the Manager-owned Achievement job. */
const getSecret = () => sessionStorage.getItem('managerServerSecret') || localStorage.getItem('managerServerSecret') || '';
const headers = () => ({ Authorization: `Bearer ${getSecret()}`, 'Content-Type': 'application/json' });

async function refreshAchievement() {
  const response = await fetch('/api/jobs/achievement', { headers: headers() });
  const state = response.ok ? await response.json() : { status: 'unauthorized', message: 'Configure Manager Secret on the dashboard.' };
  document.querySelector('#achievement-status').textContent = state.status;
  document.querySelector('#achievement-message').textContent = state.message || '';
}

document.querySelector('#achievement-start').addEventListener('click', async () => {
  await fetch('/api/jobs/achievement/start', { method: 'POST', headers: headers(), body: '{}' });
  await refreshAchievement();
});
document.querySelector('#achievement-stop').addEventListener('click', async () => {
  await fetch('/api/jobs/achievement/stop', { method: 'POST', headers: headers(), body: '{}' });
  await refreshAchievement();
});
document.querySelector('#achievement-refresh').addEventListener('click', refreshAchievement);
void refreshAchievement();
