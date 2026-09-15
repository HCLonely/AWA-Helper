/** Owns configuration transport, serialization, authentication and server error messages. */
const SettingsApi = (() => {
  function formatRequestError(error: unknown): string {
    if (SettingsModel.isRecord(error)) {
      const { response } = error;
      const responseData = SettingsModel.isRecord(response) ? response.data : undefined;
      if (SettingsModel.isRecord(responseData)) {
        if (Array.isArray(responseData.errors)) {
          return responseData.errors.map((value) => SettingsI18n.t(String(value))).join('\n');
        }
        if (typeof responseData.error === 'string') {
          return SettingsI18n.t(responseData.error);
        }
      }
      if (typeof responseData === 'string' && responseData) {
        return SettingsI18n.t(responseData);
      }
    }
    return SettingsI18n.t(error instanceof Error ? error.message : String(error));
  }
  function authorization(): { Authorization: string } {
    const secret = sessionStorage.getItem('managerServerSecret');
    if (!secret) {
      throw new Error(SettingsI18n.t('Set the Manager secret before editing configuration.'));
    }
    return { Authorization: `Bearer ${secret}` };
  }
  async function getConfig(signal?: AbortSignal): Promise<SettingsData> {
    // Axios also tries to parse JSON served as YAML unless a text response is requested.
    const response = await axios.get('/api/config', { headers: authorization(), responseType: 'text', signal });
    if (response.status !== 200) {
      throw new Error(SettingsI18n.t('Get configuration failed: %s', String(response.status)));
    }
    let data: unknown;
    try {
      data = jsyaml.load(response.data);
    } catch {
      throw new Error(SettingsI18n.t('Invalid configuration YAML'));
    }
    if (!SettingsModel.isRecord(data)) {
      throw new Error(SettingsI18n.t('Configuration must be a mapping.'));
    }
    return data;
  }
  async function setConfig(config: SettingsData, type: SettingsTemplate['type']): Promise<boolean> {
    const data = type === 'json' ? JSON.stringify(config, null, 2) : jsyaml.dump(config, { lineWidth: -1, forceQuotes: true });
    const response = await axios.put('/api/config', { config: data }, { headers: authorization() });
    if (response.status !== 200) {
      throw new Error(SettingsI18n.t('Save configuration failed: %s', String(response.status)));
    }
    const newSecret = SettingsModel.isRecord(config.manager) ? config.manager.secret : undefined;
    if (typeof newSecret === 'string' && newSecret) {
      sessionStorage.setItem('managerServerSecret', newSecret);
      if (localStorage.getItem('managerServerSecret')) {
        localStorage.setItem('managerServerSecret', newSecret);
      }
    }
    return response.data?.restartRequired === true;
  }
  async function getTemplate(url: string, signal?: AbortSignal): Promise<string> {
    let remote: URL;
    try {
      remote = new URL(url, location.href);
    } catch {
      throw new Error(SettingsI18n.t('Invalid template URL'));
    }
    remote.searchParams.set('time', String(Date.now()));
    const response = await axios.get(remote.href, { responseType: 'text', signal });
    if (response.status !== 200 || typeof response.data !== 'string') {
      throw new Error(SettingsI18n.t('Get template file failed'));
    }
    return response.data;
  }
  return { getConfig, setConfig, getTemplate, formatRequestError };
})();
Object.assign(globalThis, { SettingsApi });
