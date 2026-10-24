import { describe, expect, it } from 'vitest';
import { PRODUCTION_ORIGINS } from '../../../shared/deployment/production';
import { mvpProductionRunnerOrigin, hostedQaRunnerOrigin, mvpPreviewRunnerOrigin } from './runChallenge';

describe('Production activation boundary', () => {
  it('activates only the exact pair in a dedicated non-development Production build', () => {
    expect(
      mvpProductionRunnerOrigin(
        'mvp-production',
        PRODUCTION_ORIGINS.runner,
        PRODUCTION_ORIGINS.app,
        false,
        'production',
      ),
    ).toBe(PRODUCTION_ORIGINS.runner);
    for (const [mode, runner, parent, dev, deployment] of [
      ['production', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'production'],
      ['mvp-preview', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'production'],
      ['m3-hosted-qa', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'production'],
      ['mvp-production', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, true, 'production'],
      ['mvp-production', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'preview'],
      ['mvp-production', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, undefined],
      ['mvp-production', undefined, PRODUCTION_ORIGINS.app, false, 'production'],
    ] as const)
      expect(mvpProductionRunnerOrigin(mode, runner, parent, dev, deployment)).toBeNull();
  });

  it('rejects alternative origins and Preview gates even with all Preview flags set', () => {
    for (const text of [PRODUCTION_ORIGINS.app, PRODUCTION_ORIGINS.runner]) {
      for (const value of [
        '',
        text + '/',
        text + ':443',
        text + '.evil.test',
        text + '/path',
        text.replace('https:', 'http:'),
        text.replace('https://', 'https://user@'),
        'https://generated-immutable.vercel.app',
        'null',
      ]) {
        expect(
          mvpProductionRunnerOrigin('mvp-production', value, PRODUCTION_ORIGINS.app, false, 'production'),
        ).toBeNull();
        expect(
          mvpProductionRunnerOrigin('mvp-production', PRODUCTION_ORIGINS.runner, value, false, 'production'),
        ).toBeNull();
      }
    }
    expect(
      mvpPreviewRunnerOrigin('mvp-preview', '1', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'preview'),
    ).toBeNull();
    expect(
      hostedQaRunnerOrigin('m3-hosted-qa', '1', PRODUCTION_ORIGINS.runner, PRODUCTION_ORIGINS.app, false, 'preview'),
    ).toBeNull();
  });
});
