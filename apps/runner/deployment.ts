export function deploymentPolicy(parentText: string | undefined, runnerText: string | undefined, local = false) {
  function origin(text: string | undefined) {
    if (!text) throw new Error('Both exact runner and parent origins are required.');
    const url = new URL(text);
    if (url.origin !== text || url.username || url.password)
      throw new Error('An exact origin without a path is required.');
    if (
      local
        ? url.protocol !== 'http:' || !['app.test', 'runner.test'].includes(url.hostname)
        : url.protocol !== 'https:' || !/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname) || url.port
    ) {
      throw new Error('Use independently isolated HTTPS vercel.app sites; local tests require app.test/runner.test.');
    }
    return url;
  }
  const parent = origin(parentText),
    runner = origin(runnerText);
  if (parent.hostname === runner.hostname) throw new Error('Runner and parent must be separate sites.');
  const common = "default-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
  const page = `${common}; script-src 'self'; worker-src 'self'; connect-src 'none'; frame-ancestors ${parent.origin}`;
  const worker = `${common}; script-src 'self' 'wasm-unsafe-eval'; worker-src 'none'; connect-src 'self'; frame-ancestors 'none'`;
  return { page, worker, parent: parent.origin, runner: runner.origin };
}
