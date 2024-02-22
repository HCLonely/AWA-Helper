/* global window, location, localStorage, $, dayjs, axios */
// eslint-disable-next-line no-underscore-dangle
// todo: i18n
const time = () => `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `;
function getStatus(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: 正在获取AWA-Helper运行状态...</li>`);
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
      $('#log-area').append(`<li>${time()}AWA-Manager: 运行状态获取成功！</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      return response.data?.runStatus;
    }
    $('#log-area').append(`<li>${time()}AWA-Manager: 运行状态获取失败(${response.status})！</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    return false;
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: 运行状态获取失败(${error.message})！</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    console.error(error);
    return false;
  });
}
function startHelper(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: 正在启动AWA-Helper...</li>`);
  $('#log-area li:last')[0].scrollIntoView();
  axios.post('/start', { secret }).then(async (response) => {
    if (response.status === 200) {
      const result = await statusChecker(secret, 'start');
      if (result === 'success') {
        $('#log-area').append(`<li>${time()}AWA-Manager: 启动成功！</li>`);
        $('#log-area li:last')[0].scrollIntoView();
      } else {
        $('#log-area').append(`<li>${time()}AWA-Manager: 启动失败(${result})！</li>`);
        $('#log-area li:last')[0].scrollIntoView();
      }
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: 启动失败(${response.status})！</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('.last-run-time').text('Error');
      $('.run-status').text('Error');
    }
    console.log(response);
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: 启动失败(${error.message})！</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('.last-run-time').text('Error');
    $('.run-status').text('Error');
    console.error(error);
  });
}
function stopHelper(secret) {
  $('#log-area').append(`<li>${time()}AWA-Manager: 正在终止AWA-Helper...</li>`);
  $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在终止AWA-Helper...`);
  axios.post('/stop', { secret }).then(async (response) => {
    if (response.status === 200) {
      const result = await statusChecker(secret, 'stop');
      if (result === 'success') {
        $('#log-area').append(`<li>${time()}AWA-Manager: 终止成功！</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止成功！`);
      } else {
        $('#log-area').append(`<li>${time()}AWA-Manager: 终止失败(${result})！</li>`);
        $('#log-area li:last')[0].scrollIntoView();
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止失败(${result})！`);
      }
    } else {
      $('#log-area').append(`<li>${time()}AWA-Manager: 终止失败(${response.status})！</li>`);
      $('#log-area li:last')[0].scrollIntoView();
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止失败(${response.status})！`);
    }
    console.log(response);
  }).catch((error) => {
    $('#log-area').append(`<li>${time()}AWA-Manager: 终止失败(${error.message})！</li>`);
    $('#log-area li:last')[0].scrollIntoView();
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止失败(${error.message})！`);
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
    $('#log-area').append(`<li>${time()}请先配置Manager Server Secret!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
  }
  getStatus(managerServerSecret);
});
$('button.awa-helper-start').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}请先配置Manager Server Secret!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
  }
  startHelper(managerServerSecret);
});
$('button.awa-helper-stop').click(() => {
  if (!managerServerSecret) {
    $('#log-area').append(`<li>${time()}请先配置Manager Server Secret!</li>`);
    $('#log-area li:last')[0].scrollIntoView();
  }
  stopHelper(managerServerSecret);
});
$('button.save-secret').click(() => {
  managerServerSecret = $('#secret').val();
  localStorage.setItem('managerServerSecret', managerServerSecret);
  $('#log-area').append(`<li>${time()}Manager Server Secret已保存！</li>`);
  $('#log-area li:last')[0].scrollIntoView();
});

if (managerServerSecret) {
  getStatus(managerServerSecret);
}
