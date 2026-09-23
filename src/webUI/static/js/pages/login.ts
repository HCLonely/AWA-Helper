/** 保存凭据或进入受保护页面前，先验证凭据。 */
(() => {
  const {
    t
  } = ManagerAuth;
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh';
  document.querySelectorAll<HTMLElement>('[data-en]').forEach((element) => {
    if (lang === 'en') {
      element.textContent = element.dataset.en!;
    }
  });
  document.title = t('登录 · AWA Helper', 'Sign in · AWA Helper');
  const form = document.querySelector<HTMLFormElement>('#login-form')!;
  const secret = document.querySelector<HTMLInputElement>('#login-secret')!;
  const remember = document.querySelector<HTMLInputElement>('#login-remember')!;
  const submit = document.querySelector<HTMLButtonElement>('#login-submit')!;
  const message = document.querySelector<HTMLElement>('#login-message')!;
  const params = new URLSearchParams(location.search);
  if (params.get('reason') === 'invalid') {
    message.textContent = t('Manager Secret 无效或已更改，请重新登录。', 'The Manager Secret is invalid or has changed. Please sign in again.');
  }
  secret.addEventListener('input', () => {
    secret.removeAttribute('aria-invalid'); message.textContent = '';
  });
  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) {
      return;
    }
    busy = true;
    submit.disabled = true;
    submit.textContent = t('正在验证…', 'Verifying…');
    message.textContent = '';
    const candidate = secret.value;
    try {
      if (!await ManagerAuth.check(candidate)) {
        ManagerAuth.clear();
        message.textContent = t('Manager Secret 错误，请检查后重试。', 'Incorrect Manager Secret. Please try again.');
        secret.setAttribute('aria-invalid', 'true');
        secret.focus();
        return;
      }
      sessionStorage.setItem('managerServerSecret', candidate);
      if (remember.checked) {
        localStorage.setItem('managerServerSecret', candidate);
      } else {
        localStorage.removeItem('managerServerSecret');
      }
      location.replace(ManagerAuth.destination(params.get('next')));
    } catch {
      message.textContent = t('无法连接 Manager，请检查服务是否运行后重试。', 'Unable to connect to Manager. Check that the service is running and retry.');
    } finally {
      busy = false;
      submit.disabled = false;
      submit.textContent = t('登录', 'Sign in');
    }
  });
})();
