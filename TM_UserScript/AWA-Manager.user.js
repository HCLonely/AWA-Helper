// ==UserScript==
// @name         AWA-Manager
// @namespace    AWA-Manager
// @version      3.2.5
// @description  AWA Cookie更新
// @author       HCLonely
// @icon         https://github.com/HCLonely/AWA-Helper/raw/main/static/icon.ico
// @downloadURL  https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js
// @include      *
// @include      *://*.alienwarearena.com/*
// @run-at       document-end
// @compatible   chrome 没有测试其他浏览器的兼容性
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// ==/UserScript==
/* global window,document,GM_xmlhttpRequest,GM_cookie,GM_getValue,GM_setValue,GM_info,GM_addStyle,$, dayjs,__ */
/* eslint-disable max-len */

(async function () {
  'use strict';

  if (/^\/member\/.+?\/artifacts$/.test(window.location.pathname)) {
    $('a[data-id]').map((i, e) => $(e).after(`<p style="text-align: center;">id: ${$(e).attr('data-id')}</p>`));
  }
  const syncTime = GM_getValue('time') || 0;
  let managerServerUrl = GM_getValue('managerServerUrl') || '';
  let managerServerSecret = GM_getValue('managerServerSecret') || '';
  if (managerServerUrl && managerServerSecret) {
    if ((Date.now() - syncTime) / 3600000 > 1 || window.location.hostname.includes('.alienwarearena.com')) {
      updateCookie(managerServerUrl, managerServerSecret);
    }
  }
  const time = () => `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `;
  function request(details) {
    const config = {
      method: 'GET',
      retry: 3,
      headers: {},
      ...details
    };

    if (config.url) {
      const urlObject = new URL(config.url);
      if (!config.headers.referer) {
        config.headers.referer = urlObject.origin;
      }
      if (!config.headers.host) {
        config.headers.host = urlObject.host;
      }
    }

    if (config.dataType) {
      config.responseType = mapDataTypeToResponseType(config.dataType);
    }

    if (config.method?.toUpperCase() === 'GET' && config.params) {
      config.url = appendParamsToUrl(config.url, config.params);
    }

    if (config.method?.toUpperCase() === 'POST' && config.data) {
      if (!config.headers['Content-Type']) {
        if (config.data instanceof FormData) {
          config.headers['Content-Type'] = 'multipart/form-data';
        } else if (typeof config.data === 'object') {
          if (config.headers['Content-Type'] === 'multipart/form-data') {
            config.data = convertObjectToFormData(config.data);
          } else {
            config.headers['Content-Type'] = 'application/json';
            config.data = JSON.stringify(config.data);
          }
        } else {
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          config.data = convertObjectToFormData(config.data);
        }
      }
    }

    let retries = 0;

    const sendRequest = () => new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...config,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            const axiosResponse = {
              data: response.response,
              status: response.status,
              statusText: response.statusText,
              headers: response.responseHeaders,
              config,
              request: null
            };

            resolve(axiosResponse);
          } else {
            const axiosError = {
              message: 'Request error',
              config,
              request: null,
              response
            };

            reject(axiosError);
          }
        },
        onabort(error) {
          const axiosError = {
            message: 'Request aborted',
            config,
            request: null,
            error
          };

          reject(axiosError);
        },
        ontimeout(error) {
          const axiosError = {
            message: 'Request timed out',
            config,
            request: null,
            error
          };

          reject(axiosError);
        },
        onerror(error) {
          const axiosError = {
            message: 'Request error',
            config,
            request: null,
            error
          };

          reject(axiosError);
        }
      });
    });

    const attemptRequest = () => sendRequest().catch((error) => {
      retries++;
      if (retries <= config.retry) {
        console.warn(`Request failed, retrying (${retries}/${config.retry})...`);
        return attemptRequest();
      }
      console.error(`Request failed after ${config.retry} retries`);
      throw error;
    });

    return attemptRequest();
  }

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
  const GM_Axios = {};
  methods.forEach((method) => {
    GM_Axios[method.toLowerCase()] = function (url, config) {
      return request({
        method,
        url,
        ...config
      });
    };
  });

  function mapDataTypeToResponseType(dataType) {
    switch (dataType) {
      case 'json':
        return 'json';
      case 'text':
        return 'text';
      case 'blob':
        return 'blob';
      case 'arraybuffer':
        return 'arraybuffer';
      default:
        return 'text';
    }
  }

  function appendParamsToUrl(url, params) {
    const urlObject = new URL(url);
    const searchParams = new URLSearchParams(urlObject.search);

    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, value);
    });

    urlObject.search = searchParams.toString();
    return urlObject.href;
  }

  function convertObjectToFormData(object) {
    const formData = new FormData();

    Object.entries(object).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return formData;
  }

  function updateCookie(url, secret) {
    GM_cookie.list({ url: 'https://na.alienwarearena.com/control-center' }, (cookies, error) => {
      if (!error) {
        const cookie = cookies.map((e) => `${e.name}=${e.value}`).filter((e) => e).join(';');
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在同步Cookie...`);
        GM_Axios.post(`${url}updateCookie`, { data: { secret, cookie } }).then((response) => {
          if (response.status === 200) { // { lastRunTime, runStatus }
            GM_setValue('time', Date.now());
            $('.cookie-server-status').text('Success');
            $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Cookie同步成功！`);
            $('#log-area').append(`<li>${time()}AWA-Manager: Cookie同步成功！</li>`);
            $('#log-area li:last')[0]?.scrollIntoView();
          } else {
            $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Cookie同步失败(${response.status})！`);
            $('#log-area').append(`<li>${time()}AWA-Manager: Cookie同步失败(${response.status})！</li>`);
            $('#log-area li:last')[0]?.scrollIntoView();
            $('.cookie-server-status').text('Error');
          }
          console.log(response);
        }).catch((error) => {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Cookie同步失败(${error.message})！`);
          $('#log-area').append(`<li>${time()}AWA-Manager: Cookie同步失败(${error.message})！</li>`);
          $('#log-area li:last')[0]?.scrollIntoView();
          $('.cookie-server-status').text('Error');
          console.error(error);
        });
      } else {
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Cookie获取失败(${error.message})！`);
        $('#log-area').append(`<li>${time()}AWA-Manager: Cookie获取失败(${error.message})！</li>`);
        $('#log-area li:last')[0]?.scrollIntoView();
        $('.cookie-server-status').text('Error');
        console.error(error);
      }
    });
  }
  function updateTwitchCookie(url, secret) {
    GM_cookie.list({ url: 'https://www.twitch.tv/' }, (cookies, error) => {
      if (!error) {
        const cookie = cookies.map((e) => (['auth-token', 'unique_id'].includes(e.name) ? `${e.name}=${e.value}` : null)).filter((e) => e).join(';');
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在同步Twitch Cookie...`);
        GM_Axios.post(`${url}updateTwitchCookie`, { data: { secret, cookie } }).then((response) => {
          if (response.status === 200) {
            $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Twitch Cookie同步成功！`);
            $('#log-area').append(`<li>${time()}AWA-Manager: Twitch Cookie同步成功！</li>`);
            $('#log-area li:last')[0]?.scrollIntoView();
          } else {
            $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Twitch Cookie同步失败(${response.status})！`);
            $('#log-area').append(`<li>${time()}AWA-Manager: Twitch Cookie同步失败(${response.status})！</li>`);
            $('#log-area li:last')[0]?.scrollIntoView();
          }
          console.log(response);
        }).catch((error) => {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Twitch Cookie同步失败(${error.message})！`);
          $('#log-area').append(`<li>${time()}AWA-Manager: Twitch Cookie同步失败(${error.message})！</li>`);
          $('#log-area li:last')[0]?.scrollIntoView();
          console.error(error);
        });
      } else {
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: Twitch Cookie获取失败(${error.message})！`);
        $('#log-area').append(`<li>${time()}AWA-Manager: Twitch Cookie获取失败(${error.message})！</li>`);
        $('#log-area li:last')[0]?.scrollIntoView();
        console.error(error);
      }
    });
  }
  function getStatus(url, secret) {
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在获取AWA-Helper运行状态...`);
    return GM_Axios.post(`${url}runStatus`, { data: { secret }, dataType: 'json' }).then((response) => {
      console.log(response);
      if (response.status === 200) {
        $('.last-run-time').text(response.data?.lastRunTime);
        $('.run-status').text(response.data?.runStatus);
        if (response.data?.webui) {
          const webuiURL = new URL(url);
          webuiURL.protocol = response.data?.webui.ssl ? 'https:' : 'http:';
          webuiURL.port = response.data?.webui.port;
          $('.run-status').html(`<a href="${webuiURL.href}" target="_blank">${response.data?.runStatus}</a>`);
        }
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 运行状态获取成功！`);
        return response.data?.runStatus;
      }
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 运行状态获取失败(${response.status})！`);
      $('.last-run-time').text('Error');
      $('.run-status').text('Error');
      return false;
    }).catch((error) => {
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 运行状态获取失败(${error.message})！`);
      $('.last-run-time').text('Error');
      $('.run-status').text('Error');
      console.error(error);
      return false;
    });
  }
  function startHelper(url, secret) {
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在启动AWA-Helper...`);
    GM_Axios.post(`${url}start`, { data: { secret }, retry: 0 }).then(async (response) => {
      if (response.status === 200) {
        const result = await statusChecker(url, secret, 'start');
        if (result === 'success') {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 启动成功！`);
        } else {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 启动失败(${result})！`);
        }
      } else {
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 启动失败(${response.status})！`);
        $('.last-run-time').text('Error');
        $('.run-status').text('Error');
      }
      console.log(response);
    }).catch((error) => {
      $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 启动失败(${error.message})！`);
      $('.last-run-time').text('Error');
      $('.run-status').text('Error');
      console.error(error);
    });
  }
  function stopHelper(url, secret) {
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 正在终止AWA-Helper...`);
    GM_Axios.post(`${url}stop`, { data: { secret }, retry: 0 }).then(async (response) => {
      if (response.status === 200) {
        const result = await statusChecker(url, secret, 'stop');
        if (result === 'success') {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止成功！`);
        } else {
          $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止失败(${result})！`);
        }
      } else {
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 终止失败(${response.status})！`);
      }
      console.log(response);
    }).catch((error) => {
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
  async function statusChecker(url, secret, status, times = 1) {
    const runStatus = await getStatus(url, secret);
    if (status === 'start') {
      if (runStatus === 'Running') {
        return 'success';
      }
      if (times > 30) {
        return 'timeout';
      }
      await sleep(3);
      return await statusChecker(url, secret, status, times + 1);
    }
    if (status === 'stop') {
      if (runStatus === 'Stop') {
        return 'success';
      }
      if (times > 30) {
        return 'timeout';
      }
      await sleep(3);
      return await statusChecker(url, secret, status, times + 1);
    }
    return 'error';
  }

  if (managerServerUrl && managerServerSecret) {
    if (new URL(managerServerUrl).href === window.location.href) {
      $('button.cookie-sync,button.twitch-cookie-sync').show();
      $('button.cookie-sync').click(() => {
        updateCookie(managerServerUrl, managerServerSecret);
      });
      $('button.twitch-cookie-sync').click(() => {
        updateTwitchCookie(managerServerUrl, managerServerSecret);
      });

      GM_addStyle(`
        button.install-user-js,#user-js-not-installed {
          display: none !important;
        }
      `);
      // $('button.install-user-js').remove();
      // $('#user-js-not-installed').remove();
      $('#log-area').append(`<li>${time()}${__('userJsInstalled', GM_info.script?.version)}</li>`);
      $('#log-area li:last')[0].scrollIntoView();
    }
  }
  if (!window.location.hostname.includes('.alienwarearena.com') || window.location.pathname !== '/control-center') {
    return;
  }
  if (managerServerUrl && managerServerSecret) {
    getStatus(managerServerUrl, managerServerSecret);
  }
  $('.container.account').prepend(`<div class="row">
    <div class="col-12">
        <div class="user-profile__profile-card">
            <div class="user-profile__card-header">
                <h3>AWA Helper</h3>
                <a class="btn btn-outline-primary btn-arrow manager-server-config">ManagerServer配置</a>
                <a class="btn btn-outline-primary btn-arrow cookie-sync">同步 AWA Cookie</a>
                <a class="btn btn-outline-primary btn-arrow twitch-cookie-sync">同步 Twitch Cookie</a>
                <a class="btn btn-outline-primary btn-arrow awa-helper-start">启动AWA-Helper</a>
                <a class="btn btn-outline-primary btn-arrow awa-helper-stop">终止AWA-Helper</a>
            </div>
            <div class="user-profile__card-body">
                <div class="row mx-0">
                    <div class="card-table-heading justify-content-start">
                        <div class="col-4 text-center">上次运行时间</div>
                        <div class="col-4 text-center">运行状态<a class="btn btn-outline-primary btn-arrow refresh-status" style="font-size: .7rem;padding: .3rem .5rem;padding-right: 2rem;margin-left: .7rem;">刷新</a></div>
                        <div class="col-4 text-center">Cookie同步状态</div>
                    </div>
                </div>
<div class="row card-table-row py-2">
    <div class="d-flex align-items-center">
        <div class="col-4 text-center">
                            <span class="last-run-time" style="display: inline !important;">-</span>
                    </div>
        <div class="col-4 text-center">
                            <span class="run-status" style="display: inline !important;">-</span>
                    </div>
        <div class="col-4 text-center">
                            <span class="cookie-server-status" style="display: inline !important;">-</span>
                    </div>
    </div>
</div>
                            </div>
            <div class="user-profile__card-footer"><div id="awa-manager-server-logs" style="width:100%"></div></div>
        </div>
    </div>
</div>`);

  try {
    GM_cookie.list({ url: 'https://na.alienwarearena.com/control-center' }, (cookies, error) => {
      if (error) {
        $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 当前Tampermonkey版本不支持cookie读取，请更换BETA版本！`);
      }
    });
  } catch (e) {
    $('#awa-manager-server-logs').text(`${time()}AWA-Manager: 当前Tampermonkey版本不支持cookie读取，请更换BETA版本！`);
    console.log(e);
  }
  $('a.cookie-sync').click(() => {
    updateCookie(managerServerUrl, managerServerSecret);
  });
  $('a.twitch-cookie-sync').click(() => {
    updateTwitchCookie(managerServerUrl, managerServerSecret);
  });
  $('a.refresh-status').click(() => {
    getStatus(managerServerUrl, managerServerSecret);
  });
  $('a.awa-helper-start').click(() => {
    startHelper(managerServerUrl, managerServerSecret);
  });
  $('a.awa-helper-stop').click(() => {
    stopHelper(managerServerUrl, managerServerSecret);
  });

  $('.manager-server-config').click(() => {
    $('body').append(`<div class="row cookie-server-area" style="position:fixed;top:200px;z-index:999999999;width:100%">
    <div class="col-2"></div>
    <div class="col-8">
        <div class="user-profile__profile-card">
            <div class="user-profile__card-header">
                <h3 class="text-end">Cookie Server 配置</h3>
            </div>
            <div class="user-profile__card-body">
<div class="row card-table-row py-2">
                <div class="text-center">
                    managerServer推送地址：
                    <input type="text" class="form-control text-white" id="cookie-server-url"${managerServerUrl ? `value="${managerServerUrl}"` : ''}>
                </div>
                <div class="text-center" style="margin-top: 20px;">
                    Secret：
                    <input type="text" class="form-control text-white" id="cookie-server-secret"${managerServerSecret ? `value="${managerServerSecret}"` : ''}>
                </div>
</div>
                            </div>
            <div class="user-profile__card-footer">
                <a class="btn btn-outline-primary btn-arrow save-cookie-server">保存</a></div>
        </div>
    </div>
</div>
<div id="overlay" style="z-index: 99999999;opacity: 0.5;position: fixed;top: 0;left: 0;background: #fff;"></div>
        `);
    $('#overlay').height($(document).height());
    $('#overlay').width($(document).width());
    $('#overlay').fadeTo(200, 0.5);
    $('.save-cookie-server').click(() => {
      managerServerUrl = $('#cookie-server-url').val().trim();
      managerServerSecret = $('#cookie-server-secret').val().trim();
      GM_setValue('managerServerUrl', managerServerUrl);
      GM_setValue('managerServerSecret', managerServerSecret);
      $('.cookie-server-area,#overlay').remove();
    });
  });
}());
