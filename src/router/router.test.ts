import { describe, expect, it } from 'vitest';
import { router } from './index';

describe('application routes', () => {
  it('redirects the root route to Explore', () => {
    expect(router.getRoutes().find((route) => route.path === '/')?.redirect).toBe('/explore');
  });

  it('registers guest routes before authentication or challenge data is present', () => {
    const paths = router.getRoutes().map((route) => route.path);

    expect(paths).toEqual(expect.arrayContaining(['/explore', '/challenges/:slug', '/notebook', '/notebook/:slug']));
  });

  it('matches unrecognized paths to the not-found page', () => {
    expect(router.resolve('/unrecognized/path').matched.at(-1)?.name).toBe('not-found');
  });

  it.each([
    '#access_token=fixture-access&refresh_token=fixture-refresh',
    '#error=access_denied&error_description=fixture',
    '#%E0%A4%A',
  ])('does not forward opaque or malformed fragments to a scroll selector: %s', async (hash) => {
    const position = await router.options.scrollBehavior!(
      { ...router.resolve('/notebook'), name: 'notebook', hash },
      router.currentRoute.value,
      null,
    );

    expect(position).toEqual({ top: 0 });
  });

  it('scrolls to an existing decoded anchor without constructing a CSS selector', async () => {
    const anchor = document.createElement('section');
    anchor.id = 'learning:notes';
    document.body.append(anchor);
    try {
      const position = await router.options.scrollBehavior!(
        { ...router.resolve('/notebook'), name: 'notebook', hash: '#learning%3Anotes' },
        router.currentRoute.value,
        null,
      );

      expect(position).toEqual({ el: anchor });
    } finally {
      anchor.remove();
    }
  });
});
