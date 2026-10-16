import { expect, test } from '@playwright/test';

test('direct challenge URLs render the app after a refresh', async ({ page }) => {
  await page.goto('/challenges/longest-window');
  await expect(page.getByRole('heading', { name: 'Challenge not found' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not available in this catalog');

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Challenge not found' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});

test('primary navigation and theme work with keyboard focus', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('typescript-lab-theme', 'light'));
  await page.goto('/explore');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

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
});
