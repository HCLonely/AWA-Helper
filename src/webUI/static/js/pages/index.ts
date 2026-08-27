/** @description Controls Manager jobs and renders unified runtime status. */
(() => {
  // function __(text, ...argv) {
  //   let result = text;
  //   if (I18n[lang]?.[text]) {
  //     result = I18n[lang][text];
  //     if (argv.length > 0) {
  //       argv.forEach((s) => {
  //         result = result.replace(/%s/, s);
  //       });
  //     }
  //   }
  //   return result;
  // }
  const time = () => `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `;
  type JobStatus = 'idle' | 'running' | 'stopping' | string;
  type CheckStatus = 'start' | 'stop';

  const authorization = (secret: string) => ({ Authorization: `Bearer ${secret}` });

  async function openLog(scope: string, secret: string): Promise<void> {
    const response = await axios.get(`/api/logs/${scope}`, {
      headers: { Authorization: `Bearer ${secret}` },
      responseType: 'blob'
    });
    const text = await response.data.text();
    const utf8Blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(utf8Blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
  }
  function getStatus(secret: string): Promise<string | false | undefined> {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('gettingDailyQuestStatus')}</li>`);
    dom('#log-area li:last-child')[0].scrollIntoView();
    return axios.get('/api/jobs/dailyQuest', { headers: authorization(secret) }).then((response) => {
      console.log(response);
      if (response.status === 200) {
        const lastRunTime = response.data?.startedAt;
        const runStatus = ['running', 'stopping'].includes(response.data?.status) ? 'Running' : 'Stop';
        dom('.last-run-time').text(lastRunTime ? dayjs(lastRunTime).format('YYYY-MM-DD HH:mm:ss') : '-');
        dom('.run-status').html(`<a href="/daily-quest" target="_blank">${runStatus}</a>`);
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('getDailyQuestStatusSuccess')}</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        return runStatus;
      }
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('getDailyQuestStatusFailed')}(${response.status})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('.last-run-time').text('Error');
      dom('.run-status').text('Error');
      return false as const;
    }).catch((error) => {
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('getDailyQuestStatusFailed')}(${error.message})！</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('.last-run-time').text('Error');
      dom('.run-status').text('Error');
      console.error(error);
      return false as const;
    });
  }
  function startDailyQuest(secret: string): void {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startingDailyQuest')}</li>`);
    dom('#log-area li:last-child')[0].scrollIntoView();
    axios.post('/api/jobs/dailyQuest/start', {}, { headers: authorization(secret) }).then(async (response) => {
      if (response.status === 202) {
        const result = await statusChecker(secret, 'start');
        if (result === 'success') {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startSuccess')}</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
        } else {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${result})!</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
        }
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${response.status})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('.last-run-time').text('Error');
        dom('.run-status').text('Error');
      }
      console.log(response);
    }).catch((error) => {
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${error.message})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('.last-run-time').text('Error');
      dom('.run-status').text('Error');
      console.error(error);
    });
  }
  function stopDailyQuest(secret: string, stopManager = false): void {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stoppingDailyQuest')}</li>`);
    dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stoppingDailyQuest')}`);
    axios.post('/api/jobs/dailyQuest/stop', {}, { headers: authorization(secret) }).then(async (response) => {
      if (response.status === 200) {
        const result = await statusChecker(secret, 'stop');
        if (result === 'success') {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopSuccess')}</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
          dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopSuccess')}`);
          if (stopManager) {
            stopAWAManager(secret);
          }
        } else {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${result})!</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
          dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${result})!`);
        }
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${response.status})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${response.status})!`);
      }
      console.log(response);
    }).catch((error) => {
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${error.message})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${error.message})!`);
      console.error(error);
    });
  }
  function updateHelper(secret: string): void {
    const updateButton = dom('button.awa-helper-update');
    updateButton.prop('disabled', true);
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('updating')}</li>`);
    dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updating')}`);
    axios.post('/api/manager/update', {}, { headers: authorization(secret) }).then(async (response) => {
      if (response.status === 200 || response.status === 202) {
        await sleep(10);
        const result = await managerStatusChecker('start');
        if (result === 'success') {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateSuccessManager')}</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
          dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateSuccessManager')}`);
        } else {
          dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${result})!</li>`);
          dom('#log-area li:last-child')[0].scrollIntoView();
          dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${result})!`);
        }
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${response.status})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${response.status})!`);
      }
      console.log(response);
    }).catch((error) => {
      const status = error?.response?.status;
      const reason = error?.response?.data?.error || status || error.message;
      updateButton.prop('disabled', false);
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${reason})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${reason})!`);
      console.error(error);
    });
  }
  async function refreshUpdateButton(): Promise<void> {
    try {
      const response = await axios.get('/api/version/latest');
      if (response.data?.updateAvailable === true) {
        dom('button.awa-helper-update').show();
      } else {
        dom('button.awa-helper-update').hide();
      }
    } catch (error) {
      dom('button.awa-helper-update').hide();
      console.error(error);
    }
  }
  async function managerStatusChecker(status: CheckStatus, times = 1): Promise<'success' | 'error'> {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('gettingManagerStatus')}</li>`);
    dom('#log-area li:last-child')[0].scrollIntoView();
    const runStatus = await axios.get('/api/health/live').then(() => true).catch(() => false);
    if (status === 'start') {
      if (runStatus) {
        return 'success';
      }
      if (times > 100) {
        return 'error';
      }
      await sleep(3);
      return await managerStatusChecker(status, times + 1);
    }
    if (status === 'stop') {
      if (!runStatus) {
        return 'success';
      }
      if (times > 10) {
        return 'error';
      }
      await sleep(3);
      return await managerStatusChecker(status, times + 1);
    }
    return 'error';
  }
  function stopAWAManager(secret: string): void {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stoppingManager')}</li>`);
    dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stoppingManager')}`);
    axios.post('/api/manager/shutdown', {}, { headers: authorization(secret) }).then(async (response) => {
      const result = await managerStatusChecker('stop');
      if (result === 'success') {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('managerStopped')}</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}`);
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopManagerFailed')}(${result})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}(${result})!`);
      }
      console.log(response);
    }).catch(async (error) => {
      const result = await managerStatusChecker('stop');
      if (result === 'success') {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('managerStopped')}</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}`);
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopManagerFailed')}(${error.message})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}(${error.message})!`);
      }
      console.error(error);
    });
  }

  function updateAchievementControls(status: JobStatus): void {
    const running = status === 'running';
    const stopping = status === 'stopping';
    dom('.awa-achievement-start')
      .prop('disabled', running || stopping)
      .toggleClass('disabled', running || stopping);
    dom('.awa-achievement-stop')
      .prop('disabled', !running)
      .toggleClass('disabled', !running);
  }
  async function refreshAchievementStatus(secret: string): Promise<void> {
    try {
      const response = await axios.get('/api/jobs/achievement', {
        headers: { Authorization: `Bearer ${secret}` }
      });
      updateAchievementControls(response.data?.status);
    } catch (error) {
      console.error(error);
    }
  }
  function startAchievement(secret: string): void {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('startingAchievement')}</li>`);
    dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('startingAchievement')}`);
    axios.post('/api/jobs/achievement/start', {}, { headers: authorization(secret) }).then(async (response) => {
      if (response.status === 202) {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStarted')}</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStarted')}`);
        updateAchievementControls('running');
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStartFailed')}(${response.data})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStartFailed')}(${response.data})!`);
      }
      console.log(response);
    }).catch(async (error) => {
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStartFailed')}(${error.message})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStartFailed')}(${error.message})!`);
      console.error(error);
    });
  }
  function stopAchievement(secret: string): void {
    dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('stoppingAchievement')}</li>`);
    dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stoppingAchievement')}`);
    axios.post('/api/jobs/achievement/stop', {}, { headers: authorization(secret) }).then(async (response) => {
      if (response.data?.status === 'success') {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStopped')}</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStopped')}`);
        updateAchievementControls('idle');
      } else {
        dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStopFailed')}(${response.data})!</li>`);
        dom('#log-area li:last-child')[0].scrollIntoView();
        dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStopFailed')}(${response.data})!`);
      }
      console.log(response);
    }).catch(async (error) => {
      dom('#log-area').append(`<li>${time()}AWA-Manager: ${__('achievementStopFailed')}(${error.message})!</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      dom('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('achievementStopFailed')}(${error.message})!`);
      console.error(error);
    });
  }

  const sleep = (seconds: number): Promise<boolean> => new Promise((resolve) => {
    const timeout = setTimeout(() => {
      clearTimeout(timeout);
      resolve(true);
    }, seconds * 1000);
  });
  async function statusChecker(secret: string, status: CheckStatus, times = 1): Promise<'success' | 'timeout' | 'error'> {
    const runStatus = await getStatus(secret);
    if (status === 'start') {
      if (runStatus === 'Running') {
        return 'success';
      }
      if (times > 30) {
        return 'timeout';
      }
      await sleep(3);
      return await statusChecker(secret, status, times + 1);
    }
    if (status === 'stop') {
      if (runStatus === 'Stop') {
        return 'success';
      }
      if (times > 30) {
        return 'timeout';
      }
      await sleep(3);
      return await statusChecker(secret, status, times + 1);
    }
    return 'error';
  }
  const rememberedManagerServerSecret = localStorage.getItem('managerServerSecret');
  let managerServerSecret = rememberedManagerServerSecret || sessionStorage.getItem('managerServerSecret');
  if (managerServerSecret) {
    dom('#secret').val(managerServerSecret);
  }
  if (rememberedManagerServerSecret) {
    sessionStorage.setItem('managerServerSecret', rememberedManagerServerSecret);
    dom('#remember-secret').prop('checked', true);
  }
  dom('button.awa-helper-config').click(() => {
    window.open('/settings', '_target');
  });
  dom('button.refresh-status').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    getStatus(managerServerSecret);
  });
  dom('button.daily-quest-start').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    startDailyQuest(managerServerSecret);
  });
  dom('button.daily-quest-stop').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    stopDailyQuest(managerServerSecret);
  });
  dom('button.awa-helper-update').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    updateHelper(managerServerSecret);
  });
  void refreshUpdateButton();

  dom('button.awa-achievement-start').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    startAchievement(managerServerSecret);
  });
  dom('button.awa-achievement-stop').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    stopAchievement(managerServerSecret);
  });
  dom('button.awa-achievement-logs').click(async () => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    await openLog('achievement', managerServerSecret);
  });

  dom('button.awa-manager-stop').click(() => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    stopDailyQuest(managerServerSecret, true);
  });
  dom('button.save-secret').click(() => {
    managerServerSecret = String(dom('#secret').val() ?? '');
    sessionStorage.setItem('managerServerSecret', managerServerSecret);
    if (dom('#remember-secret').prop('checked')) {
      localStorage.setItem('managerServerSecret', managerServerSecret);
    } else {
      localStorage.removeItem('managerServerSecret');
    }
    dom('#log-area').append(`<li>${time()}${__('managerSecretSaved')}</li>`);
    dom('#log-area li:last-child')[0].scrollIntoView();
  });

  dom('a.run-logs, button.daily-quest-logs').click(async () => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    await openLog('dailyQuest', managerServerSecret);
  });

  dom('button.manager-logs').click(async () => {
    if (!managerServerSecret) {
      dom('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
      dom('#log-area li:last-child')[0].scrollIntoView();
      return;
    }
    await openLog('manager', managerServerSecret);
  });

  dom('button.install-user-js').click(() => {
    window.open('https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js', '_blank');
  });

  dom('#log-area').append(`<li id="user-js-not-installed">${time()}${__('userJsNotInstalled')}</li>`);
  dom('#log-area li:last-child')[0].scrollIntoView();

  if (managerServerSecret) {
    getStatus(managerServerSecret);
    refreshAchievementStatus(managerServerSecret);
  }
})();
