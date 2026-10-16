import { describe, expect, it } from 'vitest';
import { longestWindowCases } from './cases';
import { longestWindow } from './starter';

describe('longestWindow starter practice suite', () => {
  for (const testCase of longestWindowCases) {
    it(testCase.name, () => {
      const actual = longestWindow([...testCase.input.events], testCase.input.k);

      expect(actual).toEqual(testCase.expected);
    });
  }
});
