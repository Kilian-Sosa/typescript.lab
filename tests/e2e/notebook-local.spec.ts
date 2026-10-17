import { randomUUID } from 'node:crypto';
import { createClient, type Session } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

test.use({ trace: 'off' });
test.skip(process.env.LOCAL_NOTEBOOK_E2E !== '1', 'Run with node scripts/check-notebook-local.mjs and a disposable local Supabase stack.');

test('real authenticated attempts remain private across save, compare, export and retry', async ({ page, context }, testInfo) => {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  expect(new URL(url).hostname).toBe('127.0.0.1');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const otherClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const unique = randomUUID();
  const { data, error } = await client.auth.signUp({
    email: `notebook-${unique}@example.test`, password: randomUUID(),
  });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  const other = await otherClient.auth.signUp({
    email: `other-${unique}@example.test`, password: randomUUID(),
  });
  expect(other.error).toBeNull();
  expect(other.data.session).not.toBeNull();
  const otherAttempt = await otherClient.from('solution_attempts').insert({
    challenge_id: 'longest-window', challenge_version: '1.0.0',
    source: 'private second-account source', notes: 'Other account private canary',
    test_summary: { status: 'untested' },
  }).select('id').single();
  expect(otherAttempt.error).toBeNull();
  const olderSource = 'export function longestWindow() { return { start: 0, endExclusive: 0 }; }';
  const seed = await client.from('solution_attempts').insert({
    challenge_id: 'longest-window', challenge_version: '0.9.0',
    source: olderSource, notes: 'An older saved approach.', test_summary: { status: 'untested' },
  }).select('*').single();
  expect(seed.error).toBeNull();

  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await context.addInitScript(({ storageKey, session }: { storageKey: string; session: Session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey, session: data.session! });
  await page.goto('/challenges/longest-window');
  const source = 'export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: Math.min(events.length, k) }; }';
  await page.getByRole('textbox', { name: 'TypeScript source', exact: true }).fill(source);
  await page.getByRole('textbox', { name: 'Learning notes' }).fill('A second approach, saved without evaluation.');
  await page.getByRole('button', { name: 'Save attempt', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible();

  const saved = await client.from('solution_attempts').select('*').order('created_at', { ascending: false });
  expect(saved.error).toBeNull();
  expect(saved.data).toHaveLength(2);
  expect(saved.data![0].source).toBe(source);
  expect(saved.data![0].test_summary).toEqual({ status: 'untested' });
  expect(saved.data![1].source).toBe(olderSource);
  const unauthorized = await otherClient.from('solution_attempts').select('*').eq('id', seed.data.id);
  expect(unauthorized.error).toBeNull();
  expect(unauthorized.data).toEqual([]);

  await page.goto('/notebook/longest-window');
  await expect(page.getByRole('link', { name: 'My Notebook', exact: true }).filter({ visible: true })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('main')).toContainText(source);
  await expect(page.locator('main')).toContainText('A second approach, saved without evaluation.');
  await expect(page.locator('main')).toContainText('0.9.0');
  await page.getByRole('button', { name: /^Open attempt 1,/ }).click();
  await expect(page.locator('main')).toContainText('The original challenge statement for that revision is unavailable in this build.');
  await page.getByRole('button', { name: /^Open attempt 2,/ }).click();
  await page.getByRole('button', { name: /compare/i }).click();
  await expect(page.locator('main')).toContainText(olderSource);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.(json|ts|md)$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exportedText = Buffer.concat(chunks).toString('utf8');
  expect(exportedText).toContain('A second approach, saved without evaluation.');
  expect(exportedText).not.toContain('Other account private canary');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `output/playwright/notebook-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Retry from scratch', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'TypeScript source', exact: true })).toHaveValue(/TODO: Return the earliest longest window/);
  await expect(page.getByRole('button', { name: 'Interview mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Learning notes', exact: true })).toHaveValue('');
  await expect(page.locator('main')).not.toContainText(olderSource);

  // Authenticated API checks complement browser behavior with real RLS and grants.
  const update = await client.from('solution_attempts').update({ source: 'overwritten' }).eq('id', seed.data.id);
  expect(update.error).not.toBeNull();
  const deletion = await client.from('solution_attempts').delete().eq('id', seed.data.id);
  expect(deletion.error).not.toBeNull();
  await client.auth.signOut();
  await otherClient.auth.signOut();
});
