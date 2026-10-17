function inspectRunnerRealm() {
  const evidence = {
    appCookieVisible: document.cookie.includes('lab_app_cookie=app-cookie-canary'),
    appStorageCanary: null,
    storageDenied: false,
    runnerStorageAvailable: false,
    parentDomDenied: false,
  };
  try {
    evidence.appStorageCanary = localStorage.getItem('lab_app_storage_canary');
    localStorage.setItem('lab_runner_storage_canary', 'runner-only');
    evidence.runnerStorageAvailable = localStorage.getItem('lab_runner_storage_canary') === 'runner-only';
  } catch (error) {
    evidence.storageDenied = error?.name === 'SecurityError';
  }
  try {
    void parent.document.title;
  } catch (error) {
    evidence.parentDomDenied = error?.name === 'SecurityError';
  }
  return evidence;
}

window.addEventListener('message', async (event) => {
  if (event.source !== parent || event.origin !== window.__RUNNER_APP_ORIGIN__) return;
  if (event.data?.kind === 'fixture-opaque-target-probe') {
    parent.postMessage({ kind: 'fixture-target-probe-result', nonce: event.data.nonce }, window.__RUNNER_APP_ORIGIN__);
    return;
  }
  if (event.data?.kind !== 'fixture-inspect') return;

  let pageNetworkBlocked = false;
  try {
    await fetch(`${window.__RUNNER_APP_ORIGIN__}/probe-target`, { method: 'POST', mode: 'no-cors' });
  } catch {
    pageNetworkBlocked = true;
  }
  parent.postMessage({
    protocol: 1,
    kind: 'fixture-inspection',
    nonce: event.data.nonce,
    evidence: { ...inspectRunnerRealm(), pageNetworkBlocked, runnerMetrics: window.__runnerMetrics ?? null },
  }, window.__RUNNER_APP_ORIGIN__);
});
