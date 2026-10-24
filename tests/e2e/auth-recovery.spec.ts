import { expect, test, type BrowserContext, type Page } from '@playwright/test';

test.skip(
  process.env.M4_MOCK_AUTH_E2E !== '1',
  'Use node scripts/check-recovery.mjs for the synthetic, fully intercepted Auth/Data API.',
);
const ownerA = '00000000-0000-4000-8000-00000000000a';
const ownerB = '00000000-0000-4000-8000-00000000000b';
const sourceField = (page: Page) => page.getByRole('textbox', { name: 'TypeScript source', exact: true });
const notesField = (page: Page) => page.getByRole('textbox', { name: 'Learning notes', exact: true });

function jwt(id: string) {
  return `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.c2lnbmF0dXJl`;
}
interface DraftRow {
  user_id: string;
  challenge_id: string;
  challenge_version: string;
  source: string;
  revision: number;
  updated_at: string;
}
async function api(context: BrowserContext) {
  let loginOwner = ownerA;
  const rows = new Map<string, DraftRow>();
  const writes: { owner: string; source: string }[] = [];
  let hold: (() => Promise<void>) | null = null;
  const profile = (id: string) => ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${id}@example.test`,
    app_metadata: { provider: 'github' },
    user_metadata: {},
    created_at: '2026-10-17T00:00:00Z',
  });
  await context.route('https://m4-fixture.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    };
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/authorize') {
      const callback = url.searchParams.get('redirect_to')!;
      return route.fulfill({ status: 302, headers: { location: `${callback}?code=synthetic-pkce-code` } });
    }
    if (url.pathname === '/auth/v1/token')
      return reply({
        access_token: jwt(loginOwner),
        refresh_token: `fixture-refresh-${loginOwner}`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: profile(loginOwner),
      });
    const token = request.headers().authorization?.split(' ')[1];
    const owner = token ? (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sub as string) : '';
    if (url.pathname === '/auth/v1/user') return reply(profile(owner));
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/rest/v1/solution_attempts') return reply([]);
    if (url.pathname !== '/rest/v1/solution_drafts' || !owner)
      return reply({ message: 'Unexpected fixture request' }, 400);
    const old = rows.get(owner);
    if (request.method() === 'GET') return reply(old ? [old] : []);
    const input = request.postDataJSON() as Partial<DraftRow>;
    writes.push({ owner, source: input.source! });
    if (hold) await hold();
    // Read after any held transport delay, as a database would at execution time.
    const current = rows.get(owner);
    if (request.method() === 'POST' && current) return reply({ code: '23505' }, 409);
    if (request.method() === 'PATCH' && (!current || url.searchParams.get('revision') !== `eq.${current.revision}`))
      return reply([]);
    const row: DraftRow = {
      user_id: owner,
      challenge_id: 'longest-window',
      challenge_version: '1.0.0',
      source: input.source!,
      revision: current ? current.revision + 1 : 0,
      updated_at: new Date().toISOString(),
    };
    rows.set(owner, row);
    return reply(request.method() === 'POST' ? row : [row], request.method() === 'POST' ? 201 : 200);
  });
  return {
    rows,
    writes,
    loginAs(id: string) {
      loginOwner = id;
    },
    hold(value: typeof hold) {
      hold = value;
    },
    seed(id: string, source: string) {
      rows.set(id, {
        user_id: id,
        challenge_id: 'longest-window',
        challenge_version: '1.0.0',
        source,
        revision: 0,
        updated_at: new Date().toISOString(),
      });
    },
  };
}
async function login(page: Page) {
  await page.locator('header').getByRole('button', { name: 'Sign in with GitHub', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/challenges\/longest-window/);
}

// A 1280px content area at browser zoom 100/125/150/200% has these CSS widths.
// Viewport reflow exercises the zoom layout; CSS zoom and deviceScaleFactor do not.
for (const width of [1280, 1024, 853, 640, 390]) {
  test(`header actions reflow accessibly at ${width} CSS px`, async ({ page, context }, testInfo) => {
    await api(context);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => localStorage.setItem('typescript-lab-theme', 'light'));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/challenges/longest-window');
    const header = page.getByRole('banner');
    const repo = header.getByRole('link', { name: 'GitHub repository' });
    const theme = header.getByRole('button', { name: /Switch to .* theme/ });
    await expect(header.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible();
    const beforeLogin = await repo.boundingBox();
    await login(page);
    await expect.soft(header).not.toContainText('Private account connected');
    const signOut = header.getByRole('button', { name: 'Sign out', exact: true });
    const controls = [signOut, repo, theme];
    const boxes = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeLessThanOrEqual(44);
      boxes.push(box);
    }
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(beforeLogin!.x - boxes[1]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(beforeLogin!.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i - 1]!.x + boxes[i - 1]!.width).toBeLessThanOrEqual(boxes[i]!.x);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
    await header.getByRole('link', { name: 'typescript.lab home' }).focus();
    await page.keyboard.press('Tab');
    await expect(signOut).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(repo).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(theme).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page).toHaveTitle(/typescript.lab/i);
    await expect(
      page.getByRole('heading', { name: 'Longest Window with Limited Event Types', exact: true }),
    ).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`) });
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await signOut.click();
    await expect(header.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible();
    const afterLogout = (await repo.boundingBox())!;
    expect(Math.abs(afterLogout.x - boxes[1]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterLogout.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
  });
}

for (const width of [1280, 640, 390]) {
  test(`header pending and recovery states stay usable at ${width} CSS px`, async ({ page, context }) => {
    await api(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/challenges/longest-window');
    await login(page);
    const header = page.getByRole('banner');
    const repo = header.getByRole('link', { name: 'GitHub repository' });
    const signedIn = (await repo.boundingBox())!;
    let resumeCheck!: () => void;
    const checking = new Promise<void>((resolve) => {
      resumeCheck = resolve;
    });
    await context.route('https://m4-fixture.supabase.co/auth/v1/user', async (route) => {
      await checking;
      await route.fallback();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(header.getByRole('status')).toContainText('Checking account');
    const duringCheck = (await repo.boundingBox())!;
    expect(Math.abs(duringCheck.x - signedIn.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(duringCheck.y - signedIn.y)).toBeLessThanOrEqual(1);
    resumeCheck();
    const signOut = header.getByRole('button', { name: 'Sign out', exact: true });
    await expect(signOut).toBeEnabled();
    let finishLogout!: () => void;
    const logout = new Promise<void>((resolve) => {
      finishLogout = resolve;
    });
    let failLogout = true;
    await context.route('https://m4-fixture.supabase.co/auth/v1/logout*', async (route) => {
      await logout;
      if (failLogout) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ message: 'Fixture logout failure' }),
        });
      } else await route.fallback();
    });
    await signOut.click();
    await expect(signOut).toBeDisabled();
    await expect(signOut).toHaveAttribute('aria-busy', 'true');
    await expect(header.getByRole('status')).toContainText('Signing out');
    const duringLogout = (await repo.boundingBox())!;
    expect(Math.abs(duringLogout.x - signedIn.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(duringLogout.y - signedIn.y)).toBeLessThanOrEqual(1);
    finishLogout();
    const retry = header.getByRole('button', { name: 'Retry sign-out', exact: true });
    await expect(retry).toBeVisible();
    await expect(header.getByRole('status')).toContainText('Sign-out could not finish');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
    failLogout = false;
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(header.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible();
    await expect(header.getByRole('status')).toContainText('Signed out.');
  });
}

test('guest text and notes survive reload, while callback denial and expiry are safe and explicit', async ({
  page,
  context,
}) => {
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
  await page.goto(
    '/auth/callback?error=access_denied&error_description=untrusted-provider-value#access_token=fixture-secret',
  );
  await expect(page.getByRole('alert')).toContainText(/cancelled|denied/);
  await expect(page).toHaveURL(/\/auth\/callback$/);
  expect(messages.join(' ')).not.toMatch(/untrusted-provider-value|fixture-secret/);
  await page.goto('/auth/callback?error_code=bad_oauth_state');
  await expect(page.getByRole('alert')).toContainText(/expired|already used/);
});

test('guest import requires review and account switching restores only the matching private buffer', async ({
  page,
  context,
}) => {
  const backend = await api(context);
  backend.seed(ownerA, 'existing private cloud');
  await page.goto('/challenges/longest-window');
  await sourceField(page).fill('guest source');
  await notesField(page).fill('guest notes');
  await login(page);
  await expect(sourceField(page)).toHaveValue('existing private cloud');
  expect(backend.writes).toHaveLength(0);
  await page.getByText('Review guest draft for import', { exact: true }).click();
  await expect(page.getByLabel('Current account draft before import')).toHaveText('existing private cloud');
  await page.getByRole('button', { name: 'Import guest draft into this account' }).click();
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  await sourceField(page).fill('private A newer unsynced');
  await notesField(page).fill('private A notes');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(sourceField(page)).toHaveValue('guest source');
  await expect(notesField(page)).toHaveValue('guest notes');
  backend.loginAs(ownerB);
  await login(page);
  await expect(sourceField(page)).not.toHaveValue(/private A/);
  await expect(notesField(page)).not.toHaveValue(/private A/);
  expect(backend.rows.has(ownerB)).toBe(false);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  backend.loginAs(ownerA);
  await login(page);
  await expect(sourceField(page)).toHaveValue('private A newer unsynced');
  await expect(notesField(page)).toHaveValue('private A notes');
});

test('two tabs preserve conflicting edits and require an explicit revision choice', async ({
  page,
  context,
}, testInfo) => {
  const backend = await api(context);
  backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window');
  await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  const other = await context.newPage();
  await other.goto('/challenges/longest-window');
  await expect(sourceField(other)).toHaveValue('cloud baseline');
  await sourceField(page).fill('first tab update');
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  await sourceField(other).fill('second tab update');
  await expect(other.locator('#source-persistence')).toContainText('Draft conflict');
  await expect(other.getByLabel('Conflicting cloud draft')).toHaveText('first tab update');
  await expect(sourceField(other)).toHaveValue('second tab update');
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await other.screenshot({ path: testInfo.outputPath('draft-conflict.png'), fullPage: true });
  await other.getByRole('button', { name: 'Keep local version and retry' }).click();
  await expect(other.locator('#source-persistence')).toContainText('Saved privately');
  expect(backend.rows.get(ownerA)?.source).toBe('second tab update');
});

test('reviewing local buffers repeatedly remains bounded and reversible after reload and sign-in', async ({
  page,
  context,
}) => {
  const backend = await api(context);
  backend.seed(ownerA, 'private cloud');
  await page.goto('/challenges/longest-window');
  await sourceField(page).fill('first guest buffer');
  const other = await context.newPage();
  await other.goto('/challenges/longest-window');
  await sourceField(other).fill('second guest buffer');
  await other.close();
  await page.reload();
  await expect(sourceField(page)).toHaveValue('first guest buffer');
  const recovery = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: 'Recover another local buffer' }) });
  await recovery.locator('summary').click();
  const storageSize = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('typescript-lab-buffer-v1:')).length);
  await recovery.getByRole('button', { name: /^Review buffer/ }).click();
  await expect(sourceField(page)).toHaveValue('second guest buffer');
  await expect(recovery.getByRole('button', { name: /^Currently open/ })).toBeDisabled();
  await expect(recovery.locator('summary')).toContainText('(2)');
  const size = await storageSize();
  for (let index = 0; index < 10; index += 1) {
    await recovery.getByRole('button', { name: /^Review buffer/ }).click();
  }
  expect(await storageSize()).toBeLessThanOrEqual(size + 1);
  await expect(sourceField(page)).toHaveValue('second guest buffer');
  await notesField(page).fill('distinct notes');
  await expect(recovery.getByRole('button', { name: /^Currently open/ })).toHaveCount(0);
  await page.reload();
  await expect(sourceField(page)).toHaveValue('second guest buffer');
  await expect(notesField(page)).toHaveValue('distinct notes');
  await login(page);
  await expect(sourceField(page)).toHaveValue('private cloud');
  await page.getByText('Review guest draft for import', { exact: true }).click();
  await page.getByRole('button', { name: 'Import guest draft into this account' }).click();
  await expect(page.locator('#source-persistence')).toContainText('Saved privately');
  await expect(sourceField(page)).toHaveValue('second guest buffer');
  await expect(notesField(page)).toHaveValue('distinct notes');
});

test('offline recovery survives reload and retries without falsely reporting Saved', async ({ page, context }) => {
  const backend = await api(context);
  backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window');
  await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  await context.setOffline(true);
  await sourceField(page).fill('offline work');
  await notesField(page).fill('offline notes');
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
  const backend = await api(context);
  backend.seed(ownerA, 'cloud baseline');
  await page.goto('/challenges/longest-window');
  await login(page);
  await expect(sourceField(page)).toHaveValue('cloud baseline');
  const other = await context.newPage();
  await other.goto('/challenges/longest-window');
  await expect(other.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  let release!: () => void;
  backend.hold(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await sourceField(page).fill('private held request');
  await expect.poll(() => backend.writes.length).toBe(1);
  await other.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(sourceField(page)).not.toHaveValue('private held request');
  release();
  backend.hold(null);
  await expect(page.locator('#source-persistence')).toContainText('Guest draft');
  await expect(sourceField(page)).not.toHaveValue('private held request');
});
