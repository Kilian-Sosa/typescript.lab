import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { PRODUCTION_ORIGINS, productionAppHeaders } from '../shared/deployment/production.ts';
import { deploymentPolicy } from '../apps/runner/deployment.ts';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const artifactPath = /^(app|runner)\/\.vercel\/output\/(config\.json|static\/(index\.html|assets\/[A-Za-z0-9_.-]+))$/;
const hostname = (text) => {
  assert.ok(
    typeof text === 'string' && /^[a-z0-9-]+\.vercel\.app$/.test(text),
    'Unsupported platform hostname; review required.',
  );
  return text;
};
function json(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`Invalid ${label} JSON.`);
  }
}
function releaseHeaders(manifest, files) {
  const policies = deploymentPolicy(PRODUCTION_ORIGINS.app, PRODUCTION_ORIGINS.runner);
  const common = {
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  const expected = {
    app: productionAppHeaders(manifest.supabaseOrigin),
    page: { ...common, 'Content-Security-Policy': policies.page },
    worker: { ...common, 'Content-Security-Policy': policies.worker },
  };
  const app = json(files.get('app/.vercel/output/config.json'), 'app policy');
  const runner = json(files.get('runner/.vercel/output/config.json'), 'runner policy');
  assert.deepEqual(
    app,
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: expected.app, continue: true },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    'Unexpected app response configuration.',
  );
  assert.deepEqual(
    runner,
    {
      version: 3,
      routes: [
        { src: '/assets/worker-[^/]+\\.js', headers: expected.worker, continue: true },
        { src: '/(?!assets/worker-[^/]+\\.js$).*', headers: expected.page, continue: true },
        { handle: 'filesystem' },
      ],
    },
    'Unexpected runner response configuration.',
  );
  return expected;
}
async function bounded(response, limit) {
  assert.ok(Number(response.headers.get('content-length') ?? 0) <= limit, 'Response exceeds verification budget.');
  const chunks = [];
  let length = 0;
  const reader = response.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        assert.ok(length <= limit, 'Response exceeds verification budget.');
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
  }
  return Buffer.concat(chunks);
}
function isProtected(response) {
  if (![302, 307].includes(response.status)) return false;
  try {
    const location = new URL(response.headers.get('location'));
    return location.origin === 'https://vercel.com' && location.pathname === '/sso-api';
  } catch {
    return false;
  }
}

// The CLI always uses live fetch. Injection exists only for isolated negative-fixture tests.
export async function verifyProductionDelivery(input, { request = fetch, token, appBypass } = {}) {
  const { manifest, files, reviewedSha, teamId, phase } = input;
  assert.ok(
    manifest && manifest.version === 1 && manifest.mode === 'mvp-production' && manifest.dirty === false,
    'A clean Production release manifest is required.',
  );
  assert.match(reviewedSha ?? '', /^[a-f0-9]{40}$/, 'An explicit reviewed SHA is required.');
  assert.equal(manifest.sourceSha, reviewedSha, 'Reviewed SHA does not match the build.');
  assert.match(manifest.sourceTreeHash ?? '', /^[a-f0-9]{64}$/, 'Missing source fingerprint.');
  assert.deepEqual(manifest.origins, PRODUCTION_ORIGINS, 'Wrong release origin pair.');
  assert.match(teamId ?? '', /^team_[A-Za-z0-9]+$/, 'An explicit team ID is required.');
  assert.ok(['acceptance', 'released'].includes(phase), 'Phase must be acceptance or released.');
  for (const site of ['app', 'runner']) {
    assert.match(input[site]?.deploymentId ?? '', /^dpl_[A-Za-z0-9]+$/, 'Invalid deployment ID.');
    assert.match(input[site]?.projectId ?? '', /^prj_[A-Za-z0-9]+$/, 'Invalid project ID.');
  }
  assert.notEqual(input.app.projectId, input.runner.projectId, 'Separate projects are required.');
  assert.notEqual(input.app.deploymentId, input.runner.deploymentId, 'Separate deployments are required.');
  assert.ok(
    manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files),
    'Missing file hashes.',
  );
  const entries = Object.entries(manifest.files);
  assert.ok(
    entries.length >= 7 && entries.length <= 1000 && files instanceof Map && files.size === entries.length,
    'Incomplete or oversized release files.',
  );
  let totalBytes = 0;
  for (const [path, expectedHash] of entries) {
    assert.ok(artifactPath.test(path), 'Unsafe artifact path.');
    assert.match(expectedHash, /^[a-f0-9]{64}$/, 'Invalid artifact hash.');
    const bytes = files.get(path);
    assert.ok(Buffer.isBuffer(bytes) && bytes.length <= 16 * 1024 * 1024, 'Missing or oversized local artifact.');
    totalBytes += bytes.length;
    assert.ok(totalBytes <= 80 * 1024 * 1024, 'Local artifact budget exceeded.');
    assert.equal(hash(bytes), expectedHash, 'Local artifact hash mismatch.');
  }
  for (const site of ['app', 'runner'])
    assert.ok(files.has(`${site}/.vercel/output/static/index.html`), 'Missing HTML.');
  assert.ok(
    entries.some(([path]) => /runner\/.*\/worker-[^/]+\.js$/.test(path)),
    'Missing Worker.',
  );
  assert.ok(
    entries.some(([path]) => path.startsWith('runner/') && path.endsWith('.wasm')),
    'Missing WASM.',
  );
  const headers = releaseHeaders(manifest, files);
  assert.ok(
    typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token),
    'Read-only Vercel access is required.',
  );
  if (phase === 'acceptance')
    assert.ok(
      typeof appBypass === 'string' && appBypass.length > 0 && !/[\r\n]/.test(appBypass),
      'Authorized app automation bypass is required for acceptance.',
    );

  async function read(url, requestHeaders = {}) {
    try {
      return await request(url, {
        method: 'GET',
        headers: requestHeaders,
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new Error('Delivery request failed; details withheld to protect credentials.');
    }
  }
  async function platform(path) {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', teamId);
    if (path.startsWith('/v13/deployments/')) url.searchParams.set('withGitRepoInfo', 'true');
    const response = await read(url.href, { authorization: `Bearer ${token}` });
    assert.equal(response.status, 200, 'Platform request failed or redirected.');
    return json(await bounded(response, 1024 * 1024), 'platform response');
  }
  function identity(site, deployment) {
    assert.equal(deployment.id, input[site].deploymentId, 'Deployment identity mismatch.');
    assert.equal(deployment.projectId, input[site].projectId, 'Deployment project mismatch.');
    assert.equal(deployment.target, 'production', 'Deployment is not Production.');
    assert.equal(deployment.readyState, 'READY', 'Deployment is not ready.');
    // Custom --meta strings are not a substitute for platform-linked Git source.
    assert.equal(deployment.gitSource?.sha, reviewedSha, 'Platform-linked Git source mismatch or unavailable.');
    hostname(deployment.url);
  }
  let staticFiles = 0;
  const aliasSnapshots = new Map();
  for (const site of ['app', 'runner']) {
    const origin = PRODUCTION_ORIGINS[site];
    const host = new URL(origin).hostname;
    const deployment = await platform(`/v13/deployments/${input[site].deploymentId}`);
    identity(site, deployment);
    const project = await platform(`/v9/projects/${input[site].projectId}`);
    assert.equal(project.id, input[site].projectId, 'Project identity mismatch.');
    assert.equal(project.accountId, teamId, 'Project team mismatch.');
    assert.equal(project.name, host.split('.')[0], 'Project name mismatch.');
    identity(site, await platform(`/v13/deployments/${host}`));
    const aliases = await platform(`/v2/deployments/${input[site].deploymentId}/aliases`);
    assert.ok(
      Array.isArray(aliases.aliases) && aliases.aliases.length <= 100 && !aliases.pagination?.next,
      'Incomplete alias inventory.',
    );
    const names = aliases.aliases.map((alias) => hostname(alias.alias));
    aliasSnapshots.set(site, [...names].sort());
    assert.ok(names.includes(host), 'Exact Production alias is absent.');
    const alternatives = new Set([hostname(deployment.url), ...names, ...(deployment.alias ?? []).map(hostname)]);
    alternatives.delete(host);
    assert.ok(alternatives.size > 0, 'Missing immutable deployment hostname.');
    for (const alternative of alternatives) {
      const response = await read(`https://${alternative}/`);
      const canonical = response.headers.get('location');
      assert.ok(
        isProtected(response) ||
          ([301, 302, 307, 308].includes(response.status) && [origin, origin + '/'].includes(canonical)),
        'An alternative entry point is public or redirects elsewhere.',
      );
      await response.body?.cancel();
    }
    const anonymous = await read(origin + '/');
    if (site === 'app' && phase === 'acceptance')
      assert.ok(isProtected(anonymous), 'Acceptance app must stay Vercel-authenticated.');
    else assert.equal(anonymous.status, 200, 'Production static alias is not public.');
    await anonymous.body?.cancel();
    for (const [path, expectedHash] of entries) {
      const prefix = `${site}/.vercel/output/static/`;
      if (!path.startsWith(prefix)) continue;
      const suffix = path.slice(prefix.length);
      const requestPath = suffix === 'index.html' ? '/' : '/' + suffix;
      const response = await read(
        origin + requestPath,
        site === 'app' && phase === 'acceptance' ? { 'x-vercel-protection-bypass': appBypass } : {},
      );
      assert.equal(response.status, 200, 'Static artifact redirected or failed.');
      assert.equal(response.headers.get('location'), null, 'Static artifact unexpectedly redirects.');
      const expectedHeaders =
        site === 'app' ? headers.app : /\/assets\/worker-[^/]+\.js$/.test(requestPath) ? headers.worker : headers.page;
      for (const [name, value] of Object.entries(expectedHeaders))
        assert.equal(response.headers.get(name), value, 'Response security header mismatch.');
      if (site === 'app')
        assert.equal(response.headers.get('X-Robots-Tag'), null, 'Production app unexpectedly disables indexing.');
      const mime = response.headers.get('content-type') ?? '';
      assert.ok(
        suffix.endsWith('.wasm')
          ? /^application\/wasm\b/.test(mime)
          : suffix.endsWith('.js')
            ? /^(application|text)\/javascript\b/.test(mime)
            : suffix.endsWith('.css')
              ? /^text\/css\b/.test(mime)
              : /^text\/html\b/.test(mime),
        'Static artifact content type mismatch.',
      );
      assert.equal(hash(await bounded(response, 16 * 1024 * 1024)), expectedHash, 'Hosted artifact hash mismatch.');
      staticFiles++;
    }
  }
  // Read both identities again only after all app and runner bytes have been verified.
  for (const site of ['app', 'runner']) {
    const host = new URL(PRODUCTION_ORIGINS[site]).hostname;
    identity(site, await platform(`/v13/deployments/${host}`));
    const finalAliases = await platform(`/v2/deployments/${input[site].deploymentId}/aliases`);
    assert.ok(Array.isArray(finalAliases.aliases) && !finalAliases.pagination?.next, 'Alias inventory changed.');
    assert.deepEqual(
      finalAliases.aliases.map((alias) => hostname(alias.alias)).sort(),
      aliasSnapshots.get(site),
      'Alias inventory changed.',
    );
  }
  return {
    scope: 'delivery-only',
    phase,
    sourceSha: reviewedSha,
    staticFiles,
    appDeploymentId: input.app.deploymentId,
    runnerDeploymentId: input.runner.deploymentId,
    remaining: ['real OAuth', 'RLS with disposable accounts/data', 'live browser isolation', 'owner release decision'],
  };
}

async function main() {
  const { values } = parseArgs({
    options: Object.fromEntries(
      [
        'manifest',
        'reviewed-sha',
        'team',
        'app-project',
        'runner-project',
        'app-deployment',
        'runner-deployment',
        'phase',
      ].map((key) => [key, { type: 'string' }]),
    ),
  });
  assert.ok(values.manifest, 'An explicit reviewed manifest path is required.');
  const manifestPath = resolve(values.manifest);
  const manifest = json(await readFile(manifestPath), 'manifest');
  const files = new Map();
  assert.ok(manifest.files && Object.keys(manifest.files).length <= 1000, 'Invalid file inventory.');
  for (const path of Object.keys(manifest.files)) {
    assert.ok(artifactPath.test(path), 'Unsafe artifact path.');
    files.set(path, await readFile(resolve(dirname(manifestPath), path)));
  }
  const result = await verifyProductionDelivery(
    {
      manifest,
      files,
      reviewedSha: values['reviewed-sha'],
      teamId: values.team,
      phase: values.phase,
      app: { projectId: values['app-project'], deploymentId: values['app-deployment'] },
      runner: { projectId: values['runner-project'], deploymentId: values['runner-deployment'] },
    },
    { token: process.env.VERCEL_TOKEN, appBypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET },
  );
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(
      'STOP: Production delivery verification failed. Check clean identity, platform access, aliases, hashes and headers; sensitive details withheld.',
    );
    process.exitCode = 1;
  });
}
