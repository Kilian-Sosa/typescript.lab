import { describe, expect, it } from 'vitest';
import { longestWindowChallenge } from './metadata';
import { longestWindowCases } from './cases';
import { longestWindow } from './solution';

describe('longestWindow', () => {
  for (const testCase of longestWindowCases) {
    it(testCase.name, () => {
      const actual = longestWindow([...testCase.input.events], testCase.input.k);

      expect(actual).toEqual(testCase.expected);
    });
  }

  it('publishes the shared cases through metadata with valid example and content paths', () => {
    expect(longestWindowChallenge.cases).toBe(longestWindowCases);

    for (const exampleCaseId of longestWindowChallenge.exampleCaseIds) {
      expect(longestWindowCases.some((testCase) => testCase.id === exampleCaseId)).toBe(true);
    }

    const contentPaths = [
      longestWindowChallenge.statementPath,
      longestWindowChallenge.starterPath,
      longestWindowChallenge.learning.explanationPath,
      longestWindowChallenge.learning.solutionPath,
    ];
    for (const path of contentPaths) {
      expect(path.startsWith('challenges/longest-window/')).toBe(true);
    }
  });
});
