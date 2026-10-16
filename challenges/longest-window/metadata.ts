import type { ChallengeDefinition } from '../../shared/contracts/v1';
import { longestWindowCases, type LongestWindowInput, type LongestWindowOutput } from './cases';

export const longestWindowChallenge = {
  id: 'longest-window',
  slug: 'longest-window',
  version: '1.0.0',
  title: 'Longest Window with Limited Event Types',
  objective: 'Find the earliest longest contiguous range containing at most k distinct event identifiers.',
  difficulty: 'medium',
  estimatedMinutes: 20,
  tags: ['arrays', 'strings', 'sliding-window', 'hash-map'],
  signature: 'longestWindow(events: string[], k: number): { start: number; endExclusive: number }',
  entryPoint: 'longestWindow',
  parameterNames: ['events', 'k'],
  statementPath: 'challenges/longest-window/README.md',
  starterPath: 'challenges/longest-window/starter.ts',
  constraints: [
    'events contains between 0 and 100,000 string identifiers.',
    'k is a finite number; it may be negative, fractional, zero, or larger than the number of events.',
    'A positive fractional k permits at most the greatest whole distinct count not larger than k.',
    'Identifiers are compared by their exact string values; the empty string is a valid identifier.',
  ],
  edgeCases: [
    'An empty events array returns { start: 0, endExclusive: 0 }.',
    'A non-positive k returns { start: 0, endExclusive: 0 }.',
    'A positive k below 1 also returns the empty range because no distinct identifier can fit.',
    'If several windows have the same maximum length, choose the one with the smallest start index.',
    'Unicode identifiers and empty-string identifiers are compared as ordinary string values.',
  ],
  cases: longestWindowCases,
  exampleCaseIds: [
    'documented-sample',
    'empty-events',
    'zero-limit',
    'unicode-identifiers',
    'empty-string-identifier',
  ],
  learning: {
    hints: [
      'Grow a candidate range from left to right while keeping track of how many times each identifier appears.',
      'When the range contains too many distinct identifiers, move its left edge forward and remove an identifier only after its count reaches zero.',
      'After restoring a valid range, compare its length with the best seen so far. Keep the current best on equal lengths so the earliest start wins.',
    ],
    explanationPath: 'challenges/longest-window/EXPLANATION.md',
    solutionPath: 'challenges/longest-window/solution.ts',
  },
} satisfies ChallengeDefinition<LongestWindowInput, LongestWindowOutput>;
