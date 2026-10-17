import { expect, test } from '@playwright/test';

test('Interview Mode requires consent before Notebook navigation and keeps cancelled work', async ({ page }) => {
  await page.goto('/challenges/longest-window');
  const source = page.getByRole('textbox', { name: 'TypeScript source', exact: true });
  await source.fill('keep this independent approach');
  const notebook = page.getByRole('link', { name: 'My Notebook', exact: true }).filter({ visible: true });

  page.once('dialog', (dialog) => dialog.dismiss());
  await notebook.click();
  await expect(page).toHaveURL(/\/challenges\/longest-window$/);
  await expect(source).toHaveValue('keep this independent approach');

  page.once('dialog', (dialog) => dialog.accept());
  await notebook.click();
  await expect(page).toHaveURL(/\/notebook$/);
});

test('Learning Mode reveals the reference trace only after consent and resets hidden learning state', async ({ page }) => {
  await page.goto('/challenges/longest-window');

  const hintsHeading = page.getByRole('heading', { name: 'Progressive hints' });
  const visualizerHeading = page.getByRole('heading', { name: 'Step through the sliding window' });
  await expect(hintsHeading).toHaveCount(0);
  await expect(visualizerHeading).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show reference visualization' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Grow a candidate range from left to right');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Learning mode' }).click();
  await expect(hintsHeading).toBeVisible();
  await expect(visualizerHeading).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show hint 1' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Grow a candidate range from left to right');

  const revealVisualizer = page.getByRole('button', { name: 'Show reference visualization' });
  await expect(revealVisualizer).toBeVisible();
  await revealVisualizer.focus();
  await page.keyboard.press('Enter');
  await expect(visualizerHeading).toBeVisible();

  const next = page.getByRole('button', { name: 'Next reference step' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('visualizer-step-status')).toHaveText(/Step 2 of/);
  await expect(page.getByTestId('visualizer-explanation')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByRole('list', { name: 'Event positions and current window' })).toContainText('In current window');

  const hintButton = page.getByRole('button', { name: 'Show hint 1' });
  await hintButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: 'Grow a candidate range from left to right' })).toBeVisible();

  await page.getByRole('button', { name: 'Interview mode' }).click();
  await expect(hintsHeading).toHaveCount(0);
  await expect(visualizerHeading).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show reference visualization' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Grow a candidate range from left to right');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Learning mode' }).click();
  await expect(page.getByRole('button', { name: 'Show hint 1' })).toBeVisible();
  await expect(visualizerHeading).toHaveCount(0);
  const showAgain = page.getByRole('button', { name: 'Show reference visualization' });
  await showAgain.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('visualizer-step-status')).toHaveText(/Step 1 of/);
});

test('the reference trace has no horizontal overflow and honors reduced motion', async ({ page }) => {
  await page.goto('/challenges/longest-window');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Learning mode' }).click();
  const showVisualizer = page.getByRole('button', { name: 'Show reference visualization' });
  await expect(showVisualizer).toBeVisible();
  await showVisualizer.click();
  await expect(page.getByRole('heading', { name: 'Step through the sliding window' })).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.locator('.event-cell').first().evaluate((element) => {
    const styles = getComputedStyle(element);
    return { transitionProperty: styles.transitionProperty, transitionDuration: styles.transitionDuration };
  });
  expect(reducedMotion.transitionProperty).toBe('none');
  expect(Number.parseFloat(reducedMotion.transitionDuration)).toBeLessThanOrEqual(0.01);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.locator('.longest-window-stepper').evaluate((element) => ({
      contentWidth: element.scrollWidth,
      containerWidth: element.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.containerWidth);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
