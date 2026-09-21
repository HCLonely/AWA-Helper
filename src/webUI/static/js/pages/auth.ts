/** Shared Manager authentication, navigation and expired-session handling. */
const ManagerAuth = (() => {
  const key = 'managerServerSecret';
  const isLogin = location.pathname === '/login';
  const t = (zh: string, en: string): string => (typeof lang !== 'undefined' && lang === 'en' ? en : zh);
  const getSecret = (): string => sessionStorage.getItem(key) || localStorage.getItem(key) || '';
  const clear = (): void => {
    sessionStorage.removeItem(key); localStorage.removeItem(key);
  };
  const destination = (candidate: string | null): string => (candidate && ['/', '/settings', '/operations', '/daily-quest', '/achievement'].includes(candidate) ? candidate : '/');
  let redirecting = false;
  function redirect(invalid = false): void {
    if (redirecting || isLogin) {
      return;
    }
    redirecting = true;
    clear();
    const params = new URLSearchParams({
      next: destination(location.pathname)
    });
    if (invalid) {
      params.set('reason', 'invalid');
    }
    location.replace(`/login?${params}`);
  }
  const originalFetch = window.fetch.bind(window);
  async function check(secret: string): Promise<boolean> {
    const response = await originalFetch('/api/auth', {
      headers: {
        Authorization: `Bearer ${secret}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401) {
      return false;
    }
    if (!response.ok) {
      throw new Error('Authentication service unavailable');
    }
    const result = await response.json();
    if (result.authenticated !== true) {
      throw new Error('Invalid authentication response');
    }
    return true;
  }
  function isManagerApi(input: string): boolean {
    const url = new URL(input, location.href);
    return url.origin === location.origin && url.pathname.startsWith('/api/');
  }
  if (!isLogin) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const [input] = args;
      if (response.status === 401 && isManagerApi(input instanceof Request ? input.url : String(input))) {
        redirect(true);
      }
      return response;
    };
    if (typeof axios !== 'undefined') {
      axios.interceptors.response.use((response) => response, (error: unknown) => {
        const failure = error as { response?: { status?: number }; config?: { url?: string } };
        if (failure.response?.status === 401 && isManagerApi(failure.config?.url || '')) {
          redirect(true);
        }
        return Promise.reject(error);
      });
    }
  }
  async function verify(): Promise<boolean> {
    const secret = getSecret();
    if (!secret) {
      redirect(); return false;
    }
    if (!await check(secret)) {
      redirect(true); return false;
    }
    sessionStorage.setItem(key, secret);
    return true;
  }
  async function guard(): Promise<boolean> {
    if (isLogin) {
      return true;
    }
    document.documentElement.classList.add('auth-pending');
    const notice = document.createElement('section');
    notice.className = 'auth-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = t('正在验证登录…', 'Verifying your login…');
    document.body.append(notice);
    try {
      if (!await verify()) {
        return false;
      }
      notice.remove();
      document.documentElement.classList.remove('auth-pending');
      return true;
    } catch {
      notice.replaceChildren();
      const message = document.createElement('p');
      message.textContent = t('暂时无法验证登录，请检查服务连接后重试。', 'Unable to verify your login. Check the connection and retry.');
      message.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.className = 'btn btn-primary';
      retry.textContent = t('重试', 'Retry');
      retry.onclick = () => location.reload();
      notice.append(message, retry);
      return false;
    }
  }
  document.querySelectorAll('[data-auth-logout]').forEach((button) => {
    button.textContent = t('退出登录', 'Sign out');
    button.addEventListener('click', () => redirect());
  });
  window.addEventListener('focus', () => {
    if (!isLogin) {
      void verify().catch(() => { /* A connection failure is not an invalid secret. */ });
    }
  });
  return {
    ready: guard(),
    check,
    verify,
    redirect,
    getSecret,
    clear,
    destination,
    t
  };
})();

Object.assign(globalThis, {
  ManagerAuth
});
