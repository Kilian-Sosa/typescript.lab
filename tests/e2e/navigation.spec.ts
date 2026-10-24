import { expect, test } from '@playwright/test';

test('opaque authentication fragments never enter scroll diagnostics', async ({ page }) => {
  const diagnostics: string[] = [];
  page.on('console', (message) => diagnostics.push(message.text()));

  await page.goto('/explore#access_token=fixture-access&refresh_token=fixture-refresh');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Make space for better thinking.' })).toBeVisible();

  expect(diagnostics.filter((message) => /fixture-access|fixture-refresh/.test(message))).toEqual([]);
});

test('a published challenge route renders its content after a refresh', async ({ page }) => {
  await page.goto('/challenges/longest-window');
  await expect(page.getByRole('heading', { name: 'Longest Window with Limited Event Types' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Function contract' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Longest Window with Limited Event Types' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});

test('unknown challenge routes still show an accessible not-found state', async ({ page }) => {
  await page.goto('/challenges/not-in-the-catalog');

  await expect(page.getByRole('heading', { name: 'Challenge not found' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not available in this catalog');
  await expect(page.getByRole('main').getByRole('link', { name: 'Explore challenges' })).toBeVisible();
});

test('Interview Mode hides spoilers and Learning Mode reveals them only after confirmation', async ({ page }) => {
  await page.goto('/challenges/longest-window');

  await expect(page.getByText('Interview Mode')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learning mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show hint 1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reveal reference explanation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reveal reference solution' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('const frequencies = new Map');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Learning mode' }).click();
  await expect(page.getByRole('button', { name: 'Show hint 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Show hint 1' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Grow a candidate range from left to right' }),
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reveal reference explanation' }).click();
  await expect(page.locator('main')).toContainText('Maintain a contiguous range with a left edge');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reveal reference solution' }).click();
  await expect(page.locator('main')).toContainText('const frequencies = new Map');

  await page.getByRole('button', { name: 'Interview mode' }).click();
  await expect(page.getByRole('button', { name: 'Show hint 1' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('const frequencies = new Map');
  await expect(page.locator('main')).not.toContainText('Maintain a contiguous range with a left edge');
});

test('the example explorer validates editable input and labels its canonical output', async ({ page }) => {
  await page.goto('/challenges/longest-window');

  await page.getByRole('textbox', { name: 'Event identifiers as JSON' }).fill('["A", "B", "A"]');
  await page.getByRole('spinbutton', { name: 'Maximum distinct identifiers' }).fill('1.5');
  await expect(page.getByTestId('example-output')).toHaveText('{ start: 0, endExclusive: 1 }');
  await expect(page.getByText(/canonical reference for these example inputs/i)).toBeVisible();
  await expect(page.locator('main')).not.toContainText('tests passed');

  await page.getByRole('textbox', { name: 'Event identifiers as JSON' }).fill('["A", 2]');
  await expect(page.getByRole('alert')).toContainText('array of strings');
});

test('primary navigation and theme work with keyboard focus', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('typescript-lab-theme', 'light'));
  await page.goto('/explore');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const navigation = page.locator((page.viewportSize()?.width ?? 0) < 700 ? '.mobile-navigation' : '.sidebar');
  await expect(navigation.getByRole('link', { name: 'Practice challenges' })).toHaveAttribute(
    'href',
    '/challenges/longest-window',
  );
  await expect(navigation.locator('.router-link-active')).toHaveCount(1);

  const themeToggle = page.getByRole('button', { name: 'Switch to dark theme' });
  await themeToggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('the root URL redirects to Explore', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading', { name: /Make space for better thinking/ })).toBeVisible();
});

test('the small-screen shell has no document-wide horizontal overflow', async ({ page }) => {
  await page.goto('/explore');
  const isMobile = (page.viewportSize()?.width ?? 0) < 700;
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  if (isMobile) {
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.mobile-navigation')).toBeVisible();
  } else {
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.mobile-navigation')).toBeHidden();
  }

  await page.goto('/challenges/longest-window');
  const challengeDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(challengeDimensions.documentWidth).toBeLessThanOrEqual(challengeDimensions.viewportWidth);
});
