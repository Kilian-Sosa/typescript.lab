import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexFixtureFiles } from './static-fixture-files.mjs';

test('static fixture index serves only enumerated public files, never request paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lab-static-files-'));
  try {
    const publicRoot = join(root, 'public');
    await mkdir(join(publicRoot, 'assets'), { recursive: true });
    await writeFile(join(publicRoot, 'index.html'), 'public');
    await writeFile(join(publicRoot, 'assets', 'worker.js'), 'worker');
    await writeFile(join(root, 'private.txt'), 'not public');
    const files = await indexFixtureFiles(publicRoot);
    assert.equal(await readFile(files.get('/index.html'), 'utf8'), 'public');
    assert.equal(await readFile(files.get('/assets/worker.js'), 'utf8'), 'worker');
    for (const path of [
      '/../private.txt',
      '/assets/../../private.txt',
      '/%2e%2e/private.txt',
      '/private.txt',
      '/assets/worker.js?file=../private.txt',
    ]) {
      assert.equal(files.get(path), undefined);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
