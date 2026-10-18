import { expect, test, type BrowserContext, type Page } from '@playwright/test';

test.skip(process.env.M4_MOCK_AUTH_E2E !== '1', 'Use node scripts/check-recovery.mjs for the synthetic, fully intercepted Auth/Data API.');
const ownerA = '00000000-0000-4000-8000-00000000000a';
const ownerB = '00000000-0000-4000-8000-00000000000b';
const sourceField = (page: Page) => page.getByRole('textbox', { name: 'TypeScript source', exact: true });
const notesField = (page: Page) => page.getByRole('textbox', { name: 'Learning notes', exact: true });

function jwt(id: string) {
  return `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.c2lnbmF0dXJl`;
}
interface DraftRow { user_id: string; challenge_id: string; challenge_version: string; source: string; revision: number; updated_at: string }
async function api(context: BrowserContext) {
  let loginOwner = ownerA;
  const rows = new Map<string, DraftRow>();
  const writes: { owner: string; source: string }[] = [];
  let hold: (() => Promise<void>) | null = null;
  const profile = (id: string) => ({ id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.test`, app_metadata: { provider: 'github' }, user_metadata: {}, created_at: '2026-10-17T00:00:00Z' });
  await context.route('https://m4-fixture.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/authorize') {
      const callback = url.searchParams.get('redirect_to')!;
      return route.fulfill({ status: 302, headers: { location: `${callback}?code=synthetic-pkce-code` } });
    }
    if (url.pathname === '/auth/v1/token') return reply({ access_token: jwt(loginOwner), refresh_token: `fixture-refresh-${loginOwner}`,
      token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: profile(loginOwner) });
    const token = request.headers().authorization?.split(' ')[1];
    const owner = token ? JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sub as string : '';
    if (url.pathname === '/auth/v1/user') return reply(profile(owner));
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/rest/v1/solution_attempts') return reply([]);
    if (url.pathname !== '/rest/v1/solution_drafts' || !owner) return reply({ message: 'Unexpected fixture request' }, 400);
    const old = rows.get(owner);
    if (request.method() === 'GET') return reply(old ? [old] : []);
    const input = request.postDataJSON() as Partial<DraftRow>;
    writes.push({ owner, source: input.source! });
    if (hold) await hold();
    // Read after any held transport delay, as a database would at execution time.
    const current = rows.get(owner);
    if (request.method() === 'POST' && current) return reply({ code: '23505' }, 409);
    if (request.method() === 'PATCH' && (!current || url.searchParams.get('revision') !== `eq.${current.revision}`)) return reply([]);
    const row: DraftRow = { user_id: owner, challenge_id: 'longest-window', challenge_version: '1.0.0', source: input.source!,
      revision: current ? current.revision + 1 : 0, updated_at: new Date().toISOString() };
    rows.set(owner, row);
    return reply(request.method() === 'POST' ? row : [row], request.method() === 'POST' ? 201 : 200);
  });
  return { rows, writes, loginAs(id: string) { loginOwner = id; }, hold(value: typeof hold) { hold = value; }, seed(id: string, source: string) {
    rows.set(id, { user_id: id, challenge_id: 'longest-window', challenge_version: '1.0.0', source, revision: 0, updated_at: new Date().toISOString() });
  } };
}
async function login(page: Page) {
  await page.locator('header').getByRole('button', { name: 'Sign in with GitHub', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/challenges\/longest-window/);
}

test('guest text and notes survive reload, while callback denial and expiry are safe and explicit', async ({ page, context }) => {
  await api(context);
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  await page.goto('/challenges/longest-window');
  await sourceField(page).fill('guest work after interruption');
  await notesField(page).fill('guest reasoning');
  await page.reload();
  await expect(sourceField(page)).toHaveValue('guest work after interruption');
  await expect(notesField(page)).toHaveValue('guest reasoning');
  await expect(page.locator('#source-persistence')).toContainText('Guest draft');
  await page.goto('/auth/callback?error=access_denied&error_description=untrusted-provider-value#access_token=fixture-secret');
  await expect(page.getByRole('alert')).toContainText(/cancelled|denied/);
  await expect(page).toHaveURL(/\/auth\/callback$/);
  expect(messages.join(' ')).not.toMatch(/untrusted-provider-value|fixture-secret/);
  await page.goto('/auth/callback?error_code=bad_oauth_state');
  await expect(page.getByRole('alert')).toContainText(/expired|already used/);
});

test('guest import requires review and account switching restores only the matching private buffer', async ({ page, context }) => {
  const backend = await api(context); backend.seed(ownerA, 'existing private cloud');
  await page.goto('/challenges/longest-window');
  await sourceField(page).fill('guest source'); await notesField(page).fill('guest notes');
  await login(page);
  await expect(sourceField(page)).toHaveValue('existing private cloud');
  expect(backend.writes).toHaveLength(0);
  await page.getByText('Review guest draft for import', { exact: true }).click();
  await expect(page.getByLabel('Current account draft before import')).toHaveText('existing private cloud');
  await page.getByRole('button', { name: 'Import guest draft into this account' }).click();
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  await sourceField(page).fill('private A newer unsynced'); await notesField(page).fill('private A notes');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(sourceField(page)).toHaveValue('guest source');
  await expect(notesField(page)).toHaveValue('guest notes');
  backend.loginAs(ownerB); await login(page);
  await expect(sourceField(page)).not.toHaveValue(/private A/);
  await expect(notesField(page)).not.toHaveValue(/private A/);
  expect(backend.rows.has(ownerB)).toBe(false);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  backend.loginAs(ownerA); await login(page);
  await expect(sourceField(page)).toHaveValue('private A newer unsynced');
  await expect(notesField(page)).toHaveValue('private A notes');
});

test('two tabs preserve conflicting edits and require an explicit revision choice', async ({ page, context }, testInfo) => {
  const backend = await api(context); backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window'); await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  const other = await context.newPage(); await other.goto('/challenges/longest-window');
  await expect(sourceField(other)).toHaveValue('cloud baseline');
  await sourceField(page).fill('first tab update');
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  await sourceField(other).fill('second tab update');
  await expect(other.locator('#source-persistence')).toContainText('Draft conflict');
  await expect(other.getByLabel('Conflicting cloud draft')).toHaveText('first tab update');
  await expect(sourceField(other)).toHaveValue('second tab update');
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await other.screenshot({ path: testInfo.outputPath('draft-conflict.png'), fullPage: true });
  await other.getByRole('button', { name: 'Keep local version and retry' }).click();
  await expect(other.locator('#source-persistence')).toContainText('Saved privately');
  expect(backend.rows.get(ownerA)?.source).toBe('second tab update');
});

test('offline recovery survives reload and retries without falsely reporting Saved', async ({ page, context }) => {
  const backend = await api(context); backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window'); await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  await context.setOffline(true);
  await sourceField(page).fill('offline work'); await notesField(page).fill('offline notes');
  await expect(page.locator('#source-persistence')).toContainText('Offline');
  expect(backend.rows.get(ownerA)?.source).toBe('cloud baseline');
  await context.setOffline(false);
  await page.reload();
  await expect(sourceField(page)).toHaveValue('offline work');
  await expect(notesField(page)).toHaveValue('offline notes');
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  expect(backend.rows.get(ownerA)?.source).toBe('offline work');
});

test('late save responses cannot restore private text after another tab signs out', async ({ page, context }) => {
  const backend = await api(context); backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window'); await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  const other = await context.newPage(); await other.goto('/challenges/longest-window');
  await expect(other.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  let release!: () => void;
  backend.hold(() => new Promise<void>((resolve) => { release = resolve; }));
  await sourceField(page).fill('private held request');
  await expect.poll(() => backend.writes.length).toBe(1);
  await other.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(sourceField(page)).not.toHaveValue('private held request');
  release(); backend.hold(null);
  await expect(page.locator('#source-persistence')).toContainText('Guest draft');
  await expect(sourceField(page)).not.toHaveValue('private held request');
});
