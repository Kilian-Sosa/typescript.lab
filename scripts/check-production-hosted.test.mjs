import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PRODUCTION_ORIGINS, productionAppHeaders } from '../shared/deployment/production.ts';
import { deploymentPolicy } from '../apps/runner/deployment.ts';
import { verifyProductionDelivery } from './check-production-hosted.mjs';

const sha = 'a'.repeat(40);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sso = () => new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?url=fixture' } });
function fixture(phase = 'acceptance') {
  const policies = deploymentPolicy(PRODUCTION_ORIGINS.app, PRODUCTION_ORIGINS.runner);
  const common = {
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  const configs = {
    app: {
      version: 3,
      routes: [
        { src: '/(.*)', headers: productionAppHeaders('https://approved.supabase.co'), continue: true },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    runner: {
      version: 3,
      routes: [
        {
          src: '/assets/worker-[^/]+\\.js',
          headers: { ...common, 'Content-Security-Policy': policies.worker },
          continue: true,
        },
        {
          src: '/(?!assets/worker-[^/]+\\.js$).*',
          headers: { ...common, 'Content-Security-Policy': policies.page },
          continue: true,
        },
        { handle: 'filesystem' },
      ],
    },
  };
  const files = new Map();
  for (const site of ['app', 'runner']) {
    files.set(`${site}/.vercel/output/config.json`, Buffer.from(JSON.stringify(configs[site])));
    files.set(`${site}/.vercel/output/static/index.html`, Buffer.from(`<title>${site}</title>`));
  }
  files.set('app/.vercel/output/static/assets/app.js', Buffer.from('app artifact'));
  files.set('runner/.vercel/output/static/assets/worker-test.js', Buffer.from('worker artifact'));
  files.set('runner/.vercel/output/static/assets/engine.wasm', Buffer.from('wasm artifact'));
  const input = {
    manifest: {
      version: 1,
      mode: 'mvp-production',
      sourceSha: sha,
      sourceTreeHash: 'b'.repeat(64),
      dirty: false,
      origins: PRODUCTION_ORIGINS,
      supabaseOrigin: 'https://approved.supabase.co',
      files: Object.fromEntries([...files].map(([key, bytes]) => [key, digest(bytes)])),
    },
    files,
    reviewedSha: sha,
    teamId: 'team_fixture',
    phase,
    app: { deploymentId: 'dpl_app', projectId: 'prj_app' },
    runner: { deploymentId: 'dpl_runner', projectId: 'prj_runner' },
  };
  const responses = new Map();
  const calls = [];
  const metas = {};
  for (const site of ['app', 'runner']) {
    const hostname = new URL(PRODUCTION_ORIGINS[site]).hostname;
    metas[site] = {
      id: input[site].deploymentId,
      projectId: input[site].projectId,
      target: 'production',
      readyState: 'READY',
      gitSource: { sha },
      url: `${site}-immutable.vercel.app`,
      alias: [hostname],
    };
    responses.set(`https://api.vercel.com/v13/deployments/${input[site].deploymentId}`, () =>
      Response.json(metas[site]),
    );
    responses.set(`https://api.vercel.com/v13/deployments/${hostname}`, () => Response.json(metas[site]));
    responses.set(`https://api.vercel.com/v9/projects/${input[site].projectId}`, () =>
      Response.json({ id: input[site].projectId, name: hostname.split('.')[0], accountId: input.teamId }),
    );
    responses.set(`https://api.vercel.com/v2/deployments/${input[site].deploymentId}/aliases`, () =>
      Response.json({ aliases: [{ alias: hostname }] }),
    );
    responses.set(`https://${metas[site].url}/`, sso);
    responses.set(PRODUCTION_ORIGINS[site] + '/', (options) =>
      site === 'app' && phase === 'acceptance' && !options.headers['x-vercel-protection-bypass']
        ? sso()
        : bodyResponse(site, '/'),
    );
    for (const key of files.keys()) {
      if (!key.startsWith(`${site}/.vercel/output/static/assets/`)) continue;
      const path = key.split('/static')[1];
      responses.set(PRODUCTION_ORIGINS[site] + path, () => bodyResponse(site, path));
    }
  }
  function bodyResponse(site, path) {
    const headers =
      site === 'app'
        ? configs.app.routes[0].headers
        : configs.runner.routes[path.startsWith('/assets/worker-') ? 0 : 1].headers;
    const type = path === '/' ? 'text/html' : path.endsWith('.wasm') ? 'application/wasm' : 'application/javascript';
    return new Response(files.get(`${site}/.vercel/output/static${path === '/' ? '/index.html' : path}`), {
      status: 200,
      headers: { ...headers, 'Content-Type': type },
    });
  }
  const request = async (target, options) => {
    const url = new URL(target);
    calls.push({ url: url.href, options });
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    if (url.origin === 'https://api.vercel.com') {
      assert.equal(options.headers.authorization, 'Bearer platform-fixture');
      assert.equal(options.headers['x-vercel-protection-bypass'], undefined);
      assert.equal(url.searchParams.get('teamId'), input.teamId);
      assert.equal(
        url.searchParams.get('withGitRepoInfo'),
        url.pathname.startsWith('/v13/deployments/') ? 'true' : null,
      );
    } else {
      assert.equal(options.headers.authorization, undefined);
      if (url.origin !== PRODUCTION_ORIGINS.app) assert.equal(options.headers['x-vercel-protection-bypass'], undefined);
    }
    const respond = responses.get(url.origin + url.pathname);
    assert.ok(respond, 'Unexpected requested endpoint');
    return respond(options);
  };
  const run = () =>
    verifyProductionDelivery(input, {
      request,
      token: 'platform-fixture',
      appBypass: phase === 'acceptance' ? 'app-fixture' : undefined,
    });
  return { input, responses, calls, metas, run, bodyResponse };
}

test('delivery verification independently checks platform identity and every emitted static byte/header', async () => {
  for (const phase of ['acceptance', 'released']) {
    const f = fixture(phase);
    const result = await f.run();
    assert.equal(result.scope, 'delivery-only');
    assert.equal(result.sourceSha, sha);
    assert.equal(result.staticFiles, 5);
    const platformCalls = f.calls
      .map(({ url }) => new URL(url))
      .filter(({ origin }) => origin === 'https://api.vercel.com');
    assert.ok(platformCalls.some(({ pathname }) => pathname === '/v13/deployments/dpl_app'));
    assert.ok(
      platformCalls.some(({ pathname }) => pathname === `/v13/deployments/${new URL(PRODUCTION_ORIGINS.app).hostname}`),
    );
  }
});

test('invalid or dirty release identity fails before any request', async () => {
  for (const mutate of [
    (x) => {
      x.manifest.dirty = true;
    },
    (x) => {
      x.reviewedSha = 'c'.repeat(40);
    },
    (x) => {
      x.manifest.origins = { ...PRODUCTION_ORIGINS, runner: PRODUCTION_ORIGINS.app };
    },
    (x) => {
      x.app.projectId = 'https://evil.test';
    },
    (x) => {
      x.manifest.files['app/.vercel/output/static/../../escape.js'] = 'b'.repeat(64);
    },
    (x) => {
      x.files.set('app/.vercel/output/static/assets/app.js', Buffer.from('different local bytes'));
    },
    (x) => {
      x.manifest.mode = 'mvp-preview';
    },
    (x) => {
      const path = 'runner/.vercel/output/config.json';
      const config = JSON.parse(x.files.get(path));
      config.routes[0].headers['Content-Security-Policy'] = 'default-src *';
      const bytes = Buffer.from(JSON.stringify(config));
      x.files.set(path, bytes);
      x.manifest.files[path] = digest(bytes);
    },
  ]) {
    const f = fixture();
    mutate(f.input);
    await assert.rejects(f.run);
    assert.equal(f.calls.length, 0);
  }
});

test('platform target, Git SHA, project, team, readiness and exact alias identity are mandatory', async () => {
  for (const mutate of [
    (f) => {
      f.metas.app.target = 'preview';
    },
    (f) => {
      f.metas.runner.gitSource.sha = 'c'.repeat(40);
    },
    (f) => {
      delete f.metas.app.gitSource;
    },
    (f) => {
      f.metas.app.projectId = 'prj_other';
    },
    (f) => {
      f.metas.runner.readyState = 'BUILDING';
    },
    (f) => {
      f.responses.set('https://api.vercel.com/v9/projects/prj_app', () =>
        Response.json({ id: 'prj_app', name: 'wrong', accountId: 'team_other' }),
      );
    },
    (f) => {
      f.responses.set('https://api.vercel.com/v2/deployments/dpl_app/aliases', () => Response.json({ aliases: [] }));
    },
    (f) => {
      f.responses.set(`https://api.vercel.com/v13/deployments/${new URL(PRODUCTION_ORIGINS.app).hostname}`, () =>
        Response.json({ ...f.metas.app, id: 'dpl_other' }),
      );
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.run);
  }
});

test('unprotected generated/extra hostnames, redirects, wrong hashes and weakened headers fail closed', async () => {
  for (const mutate of [
    (f) => {
      f.responses.set('https://runner-immutable.vercel.app/', () => new Response('public'));
    },
    (f) => {
      f.responses.set('https://api.vercel.com/v2/deployments/dpl_runner/aliases', () =>
        Response.json({
          aliases: [{ alias: new URL(PRODUCTION_ORIGINS.runner).hostname }, { alias: 'extra-public.vercel.app' }],
        }),
      );
      f.responses.set('https://extra-public.vercel.app/', () => new Response('public'));
    },
    (f) => {
      f.responses.set(
        PRODUCTION_ORIGINS.runner + '/assets/engine.wasm',
        () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      );
    },
    (f) => {
      f.responses.set(PRODUCTION_ORIGINS.runner + '/assets/worker-test.js', () => new Response('modified'));
    },
    (f) => {
      f.responses.set(PRODUCTION_ORIGINS.runner + '/', () => {
        const r = f.bodyResponse('runner', '/');
        r.headers.set('Content-Security-Policy', 'default-src *');
        return r;
      });
    },
    (f) => {
      f.responses.set(PRODUCTION_ORIGINS.app + '/', () => f.bodyResponse('app', '/'));
    },
    (f) => {
      f.responses.set(
        'https://api.vercel.com/v13/deployments/dpl_app',
        () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      );
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.run);
  }
});

test('platform errors never echo response payloads or credentials', async () => {
  const f = fixture();
  f.responses.set(
    'https://api.vercel.com/v13/deployments/dpl_app',
    () => new Response('platform-fixture app-fixture sensitive payload', { status: 403 }),
  );
  await assert.rejects(f.run, (error) => !/platform-fixture|app-fixture|sensitive/.test(error.message));
});

test('alias inventory cannot change unnoticed while artifacts are being verified', async () => {
  const f = fixture();
  let reads = 0;
  f.responses.set('https://api.vercel.com/v2/deployments/dpl_app/aliases', () =>
    Response.json({
      aliases: [
        { alias: new URL(PRODUCTION_ORIGINS.app).hostname },
        ...(++reads > 1 ? [{ alias: 'new-entry.vercel.app' }] : []),
      ],
    }),
  );
  await assert.rejects(f.run, /Alias inventory changed/);
});

test('oversized responses, wrong MIME and weakened common headers fail delivery checks', async () => {
  for (const [header, value] of [
    ['Content-Length', String(17 * 1024 * 1024)],
    ['Content-Type', 'text/html'],
    ['X-Content-Type-Options', ''],
    ['Referrer-Policy', 'origin'],
  ]) {
    const f = fixture();
    f.responses.set(PRODUCTION_ORIGINS.runner + '/assets/worker-test.js', () => {
      const response = f.bodyResponse('runner', '/assets/worker-test.js');
      response.headers.set(header, value);
      return response;
    });
    await assert.rejects(f.run);
  }
});

test('both alias identities are read back after the entire pair has been checked', async () => {
  const f = fixture();
  f.responses.set(PRODUCTION_ORIGINS.runner + '/assets/engine.wasm', () => {
    f.metas.app.id = 'dpl_changed';
    return f.bodyResponse('runner', '/assets/engine.wasm');
  });
  await assert.rejects(f.run, /Deployment identity mismatch/);
});
