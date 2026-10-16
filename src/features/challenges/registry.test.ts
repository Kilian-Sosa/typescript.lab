import { describe, expect, it } from 'vitest';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import { longestWindowChallenge } from '../../../challenges/longest-window/metadata';
import { findChallenge, getChallenge, listChallenges } from './registry';

describe('challenge registry', () => {
  it('publishes the canonical definition and its shared cases', () => {
    const challenge = getChallenge('longest-window');

    expect(challenge).toBe(longestWindowChallenge);
    expect(challenge?.cases).toBe(longestWindowCases);
    expect(findChallenge('longest-window')).toMatchObject({
      id: 'longest-window',
      slug: 'longest-window',
      title: longestWindowChallenge.title,
    });
    expect(listChallenges()).toContainEqual(expect.objectContaining({ slug: 'longest-window' }));
  });

  it('returns undefined for an unknown challenge slug', () => {
    expect(getChallenge('not-in-the-catalog')).toBeUndefined();
    expect(findChallenge('not-in-the-catalog')).toBeUndefined();
  });
});
