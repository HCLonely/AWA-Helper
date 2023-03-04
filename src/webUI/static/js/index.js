/* global window, WebSocket, $, I18n, lang, dayjs */
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
function generateTaskInfo(data) {
  if (data) {
    Object.entries(data).filter(([name]) => name.includes(__('dailyTask'))).forEach(([name, value], index) => {
      $(`#daily-quest-${index}`).find('th').text(name);
      $(`#daily-quest-${index}`).find('td').eq(0)
        .text(value[__('status')]);
      $(`#daily-quest-${index}`).find('td').eq(1)
        .text(value[__('obtainedARP')]);
      $(`#daily-quest-${index}`).find('td').eq(2)
        .text(value[__('maxAvailableARP')]);
      $(`#daily-quest-${index}`).show();

      if (value[__('obtainedARP')] > 0) {
        $(`#daily-quest-${index}`).attr('class', 'table-success');
      }
    });

    $('#time-on-site').find('td').eq(0)
      .text(data[__('timeOnSite')][__('status')]);
    $('#time-on-site').find('td').eq(1)
      .text(data[__('timeOnSite')][__('obtainedARP')]);
    $('#time-on-site').find('td').eq(2)
      .text(data[__('timeOnSite')][__('maxAvailableARP')]);
    $('#watch-twitch').find('td').eq(0)
      .text(data[__('watchTwitch')][__('status')]);
    $('#watch-twitch').find('td').eq(1)
      .text(data[__('watchTwitch')][__('obtainedARP')]);
    $('#watch-twitch').find('td').eq(2)
      .text(data[__('watchTwitch')][__('maxAvailableARP')]);
    $('#steam-quest').find('td').eq(0)
      .text(data[__('steamQuest')][__('status')]);
    $('#steam-quest').find('td').eq(1)
      .text(data[__('steamQuest')][__('obtainedARP')]);
    $('#steam-quest').find('td').eq(2)
      .text(data[__('steamQuest')][__('maxAvailableARP')]);
    if (data[__('timeOnSite')][__('obtainedARP')] === data[__('timeOnSite')][__('maxAvailableARP')]) {
      $('#time-on-site').attr('class', 'table-success');
    }
    if (data[__('watchTwitch')][__('obtainedARP')] === data[__('watchTwitch')][__('maxAvailableARP')]) {
      $('#watch-twitch').attr('class', 'table-success');
    }
    return;
  }
  $('#table-head').find('th').eq(1)
    .text(__('status'));
  $('#table-head').find('th').eq(2)
    .text(__('obtainedARP'));
  $('#table-head').find('th').eq(3)
    .text(__('maxAvailableARP'));
  $('#daily-quest-0').find('th').text(__('dailyTask'));
  $('#time-on-site').find('th').text(__('timeOnSite'));
  $('#watch-twitch').find('th').text(__('watchTwitch'));
  $('#steam-quest').find('th').text(__('steamQuest'));
  $('#log-title').text(__('log'));
}
function time() {
  return `<font class="gray">[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] </font>`;
}
function connectWebUIServer(retry = 0) {
  $('#log-area').append(`<li>${time()}${__('connectingWebUI')}</li>`);
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let wsPort = '';
  if (window.location.host === window.location.hostname) {
    wsPort = window.location.protocol === 'https:' ? ':443' : ':80';
  }

  const ws = new WebSocket(`${wsProtocol}://${window.location.host}${wsPort}/ws`);
  ws.onopen = function () {
    console.log(__('connectWebUISuccess'));
    $('#log-area').html('');
    retry = 0;
  };
  ws.onclose = function () {
    console.log(__('WebUIClosed'));
    $('#log-area').append(`<li>${time()}<font class="yellow">${__('WebUIClosed')}</li>`);
  };
  ws.onerror = function () {
    if (retry > 5) {
      $('#log-area').append(`<li>${time()}<font class="red">${__('giveUpReconnectWebUI')}</font></li>`);
      return;
    }
    $('#log-area').append(`<li>${time()}<font class="blue">${__('reconnectingWebUI')}</font></li>`);
    connectWebUIServer(++retry);
  };
  ws.onmessage = function (e) {
    console.log(`message:${e.data}`);
    const data = JSON.parse(e.data);
    if (data.type === 'logs') {
      for (const value of Object.values(data)) {
        if (value === 'logs' || (typeof value.data === 'string' && value.data.includes('by HCLonely'))) continue;
        if (value.type === 'questInfo') {
          generateTaskInfo(value.data);
          continue;
        }
        const logEle = $(`#log-${value.id}`);
        if (logEle.length > 0) {
          logEle.html(value.data);
          logEle[0].scrollIntoView();
          continue;
        }
        $('#log-area').append(`<li id="log-${value.id}">${value.data}</li>`);
        $(`#log-${value.id}`)[0].scrollIntoView();
      }
    } else if (data.type === 'log') {
      const logEle = $(`#log-${data.id}`);
      if (logEle.length > 0) {
        logEle.html(data.data);
        logEle[0].scrollIntoView();
      } else {
        $('#log-area').append(`<li id="log-${data.id}">${data.data}</li>`);
        $(`#log-${data.id}`)[0].scrollIntoView();
      }
    } else if (data.type === 'questInfo') {
      generateTaskInfo(data.data);
    }
  };
}
connectWebUIServer();
generateTaskInfo();
