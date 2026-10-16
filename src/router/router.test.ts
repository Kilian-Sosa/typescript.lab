import { describe, expect, it } from 'vitest';
import { router } from './index';

describe('application routes', () => {
  it('redirects the root route to Explore', () => {
    expect(router.getRoutes().find((route) => route.path === '/')?.redirect).toBe('/explore');
  });

  it('registers guest routes before authentication or challenge data is present', () => {
    const paths = router.getRoutes().map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/explore',
        '/challenges/:slug',
        '/notebook',
        '/notebook/:slug',
      ]),
    );
  });

  it('matches unrecognized paths to the not-found page', () => {
    expect(router.resolve('/unrecognized/path').matched.at(-1)?.name).toBe('not-found');
  });
});
