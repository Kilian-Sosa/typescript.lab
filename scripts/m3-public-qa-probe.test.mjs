import test from 'node:test';
import assert from 'node:assert/strict';
import { checksFor, QA, runProbe } from './m3-public-qa-probe.mjs';

const makeResponse = (kind, override = {}) => {
  const headers = {
    location: kind === 'sso' ? 'https://vercel.com/sso-api?url=synthetic' : '',
    'content-type':
      kind === 'html'
        ? 'text/html; charset=utf-8'
        : kind === 'worker'
          ? 'application/javascript'
          : kind === 'wasm'
            ? 'application/wasm'
            : 'text/plain',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    'content-security-policy':
      kind === 'worker'
        ? "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'"
        : `default-src 'none'; frame-ancestors ${QA.app}`,
  };
  return new Response(kind === 'html' ? '<title>TypeScript Lab isolated runner</title>' : null, {
    status: kind === 'sso' ? 302 : kind === '404' ? 404 : 200,
    headers: { ...headers, ...override },
  });
};

const fixtures = (phase) => new Map(checksFor(phase).map(([, url, kind]) => [url, makeResponse(kind)]));
const mock = (fixtures) => async (url, options) => {
  assert.equal(options.redirect, 'manual');
  assert.equal(options.credentials, 'omit');
  assert.ok(['GET', 'HEAD'].includes(options.method));
  assert.equal(new URL(url).protocol, 'https:');
  const result = fixtures.get(url);
  assert.ok(result, `Unexpected requested host ${url}`);
  return result.clone();
};

test('protected / reprotected require SSO on all exact QA and Production domains', async () => {
  for (const phase of ['protected', 'reprotected']) {
    assert.equal((await runProbe(phase, mock(fixtures(phase)))).length, 5);
  }
});

test('public preview checks exact runner, Worker, WASM and scope', async () => {
  assert.equal((await runProbe('public', mock(fixtures('public')))).length, 8);
});

test('preflight fails on unexpectedly public app or immutable runner', async () => {
  for (const phase of ['protected', 'public']) {
    const f = fixtures(phase);
    f.set(QA.app + '/', makeResponse('html'));
    await assert.rejects(() => runProbe(phase, mock(f)), /Application QA.*SSO/);
  }
  const f = fixtures('public');
  f.set(QA.runnerImmutable + '/', makeResponse('html'));
  await assert.rejects(() => runProbe('public', mock(f)), /Runner immutable Preview.*SSO/);
});

test('public runner fails closed on wrong CSP, missing asset and SSO redirect', async () => {
  const fixes = [
    [QA.runner + '/', makeResponse('html', { 'content-security-policy': "default-src 'self'; frame-ancestors *" })],
    [QA.runner + QA.worker, makeResponse('worker', { 'content-security-policy': "script-src 'self'" })],
    [QA.runner + QA.wasm, makeResponse('sso')],
    [QA.runner + '/nonexistent-m3-public-qa-asset', makeResponse('html')],
    [
      QA.runner + '/nonexistent-m3-public-qa-asset',
      makeResponse('404', { 'content-security-policy': "default-src 'self'" }),
    ],
  ];
  for (const [url, response] of fixes) {
    const f = fixtures('public');
    f.set(url, response);
    await assert.rejects(() => runProbe('public', mock(f)));
  }
});

test('invalid probe phase cannot cause requests', async () => {
  await assert.rejects(
    () =>
      runProbe('production', () => {
        throw Error('Should not fetch');
      }),
    /Mode must/,
  );
});
