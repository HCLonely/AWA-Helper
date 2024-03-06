/* global window, location, localStorage, $, I18n, lang, dayjs, axios */
// eslint-disable-next-line no-underscore-dangle
function __(text, ...argv) {
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
const time = () => `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `;
function getStatus(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('gettingHelperStatus')}</li>`);
  $('#log-area li:last')[0].scrollIntoView();
  return axios.post('/runStatus', { secret }).then((response) => {
    console.log(response);
    if (response.status === 200) {
      $('.last-run-time').text(response.data?.lastRunTime);
      $('.run-status').text(response.data?.runStatus);
      if (response.data?.webui) {
        const webuiURL = new URL(location.href);
        webuiURL.protocol = response.data?.webui.ssl ? 'https:' : 'http:';
        webuiURL.port = response.data?.webui.port;
        $('.run-status').html(`<a href="${webuiURL.href}" target="_blank">${response.data?.runStatus}</a>`);
      }
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('getHelperStatusSuccess')}</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      return response.data?.runStatus;
    }
    $('#log-area').append(`<li>${time()}AWA-Manager: ${__('getHelperStatusFailed')}(${response.status})!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    return false;
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: ${__('getHelperStatusFailed')}(${error.message})！</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    console.error(error);
    return false;
  });
}
function startHelper(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('startingHelper')}</li>`);
  $('#log-area li:last')[0].scrollIntoView();
  axios.post('/start', { secret }).then(async (response) => {
    if (response.status === 200) {
      const result = await statusChecker(secret, 'start');
      if (result === 'success') {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('startSuccess')}</li>`);
        $('#log-area li:last')[0].scrollIntoView();
      } else {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${result})!</li>`);
        $('#log-area li:last')[0].scrollIntoView();
      }
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${response.status})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('.last-run-time').text('Error');
      $('.run-status').text('Error');
    }
    console.log(response);
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: ${__('startFailed')}(${error.message})!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    console.error(error);
  });
}
function stopHelper(secret, stopManager = false) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stoppingHelper')}</li>`);
  $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stoppingHelper')}`);
  axios.post('/stop', { secret }).then(async (response) => {
    if (response.status === 200) {
      const result = await statusChecker(secret, 'stop');
      if (result === 'success') {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopSuccess')}</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopSuccess')}`);
        if (stopManager) {
          stopAWAManager(secret);
        }
      } else {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${result})!</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${result})!`);
      }
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${response.status})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${response.status})!`);
    }
    console.log(response);
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopFailed')}(${error.message})!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stopFailed')}(${error.message})!`);
    console.error(error);
  });
}
function updateHelper(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updating')}</li>`);
  $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updating')}`);
  axios.post('/update', { secret }).then(async (response) => {
    if (response.status === 200) {
      await sleep(10);
      const result = await managerStatusChecker('start');
      if (result === 'success') {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateSuccessManager')}</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateSuccessManager')}`);
      } else {
        $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${result})!</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${result})!`);
      }
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${response.status})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${response.status})!`);
    }
    console.log(response);
  }).catch(async (error) => {
    await sleep(10);
    const result = await managerStatusChecker('start');
    if (result === 'success') {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateSuccessManager')}</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateSuccessManager')}`);
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('updateFailed')}(${error.message})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('updateFailed')}(${error.message})!`);
      console.error(error);
    }
  });
}
async function managerStatusChecker(status, times = 1) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('gettingManagerStatus')}</li>`);
  $('#log-area li:last')[0].scrollIntoView();
  const runStatus = await axios.get('/').then(() => true).catch(() => false);
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
    return await statusChecker(status, times + 1);
  }
  return 'error';
}
function stopAWAManager(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stoppingManager')}</li>`);
  $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('stoppingManager')}`);
  axios.post('/stopManager', { secret }).then(async (response) => {
    const result = await managerStatusChecker('stop');
    if (result === 'success') {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('managerStopped')}</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}`);
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopManagerFailed')}(${result})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}(${result})!`);
    }
    console.log(response);
  }).catch(async (error) => {
    const result = await managerStatusChecker('stop');
    if (result === 'success') {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('managerStopped')}</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}`);
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: ${__('stopManagerFailed')}(${error.message})!</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: ${__('managerStopped')}(${error.message})!`);
    }
    console.error(error);
  });
}

const sleep = (time) => new Promise((resolve) => {
  const timeout = setTimeout(() => {
    clearTimeout(timeout);
    resolve(true);
  }, time * 1000);
});
async function statusChecker(secret, status, times = 1) {
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
let managerServerSecret = localStorage.getItem('managerServerSecret');
$('button.awa-helper-config').click(() => {
  window.open('/configer', '_target');
});
$('button.refresh-status').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  getStatus(managerServerSecret);
});
$('button.awa-helper-start').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  startHelper(managerServerSecret);
});
$('button.awa-helper-stop').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  stopHelper(managerServerSecret);
});
$('button.awa-helper-update').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  updateHelper(managerServerSecret);
});

$('button.awa-manager-stop').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  stopHelper(managerServerSecret, true);
});
$('button.save-secret').click(() => {
  managerServerSecret = $('#secret').val();
  localStorage.setItem('managerServerSecret', managerServerSecret);
  $('#log-area').append(`<li>${time()}${__('managerSecretSaved')}</li>`);
  $('#log-area li:last')[0].scrollIntoView();
});

$('a.run-logs').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}${__('setManagerSecretNotice')}</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    return;
  }
  window.open(`/runLogs?secret=${managerServerSecret}`);
});

$('button.install-user-js').click(() => {
  window.open('https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js', '_blank');
});

$('#log-area').append(`<li id="user-js-not-installed">${time()}${__('userJsNotInstalled')}</li>`);
$('#log-area li:last')[0].scrollIntoView();

if (managerServerSecret) {
  getStatus(managerServerSecret);
}
