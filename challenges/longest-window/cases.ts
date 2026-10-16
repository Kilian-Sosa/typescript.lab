import type { ChallengeCase } from '../../shared/contracts/v1';

export type LongestWindowInput = {
  events: string[];
  k: number;
};

export type LongestWindowOutput = {
  start: number;
  endExclusive: number;
};

export const longestWindowCases: readonly ChallengeCase<LongestWindowInput, LongestWindowOutput>[] = [
  {
    id: 'documented-sample',
    name: 'chooses the earliest window when the longest windows tie',
    input: { events: ['A', 'B', 'A', 'C', 'B', 'B'], k: 2 },
    expected: { start: 0, endExclusive: 3 },
  },
  {
    id: 'empty-events',
    name: 'returns the empty window for an empty input',
    input: { events: [], k: 2 },
    expected: { start: 0, endExclusive: 0 },
  },
  {
    id: 'zero-limit',
    name: 'returns the empty window when no distinct identifiers are allowed',
    input: { events: ['A', 'B'], k: 0 },
    expected: { start: 0, endExclusive: 0 },
  },
  {
    id: 'negative-limit',
    name: 'returns the empty window for a negative distinct identifier limit',
    input: { events: ['A'], k: -1 },
    expected: { start: 0, endExclusive: 0 },
  },
  {
    id: 'fractional-limit',
    name: 'uses the greatest whole distinct count within a positive fractional limit',
    input: { events: ['A', 'B', 'A'], k: 1.5 },
    expected: { start: 0, endExclusive: 1 },
  },
  {
    id: 'fractional-limit-below-one',
    name: 'returns the empty window when a positive fractional limit allows no identifier',
    input: { events: ['A', 'B'], k: 0.5 },
    expected: { start: 0, endExclusive: 0 },
  },
  {
    id: 'limit-exceeds-distinct-count',
    name: 'returns all events when the limit exceeds the distinct count',
    input: { events: ['A', 'B', 'A'], k: 1_000_000 },
    expected: { start: 0, endExclusive: 3 },
  },
  {
    id: 'limit-equals-distinct-count',
    name: 'returns all events when the limit equals the distinct count',
    input: { events: ['A', 'B', 'A'], k: 2 },
    expected: { start: 0, endExclusive: 3 },
  },
  {
    id: 'single-event',
    name: 'returns the only event when one event is allowed',
    input: { events: ['X'], k: 1 },
    expected: { start: 0, endExclusive: 1 },
  },
  {
    id: 'all-events-identical',
    name: 'keeps a full run of one repeated identifier',
    input: { events: ['A', 'A', 'A', 'A'], k: 1 },
    expected: { start: 0, endExclusive: 4 },
  },
  {
    id: 'unicode-identifiers',
    name: 'compares Unicode identifiers by their exact string values',
    input: { events: ['🌻', '猫', '🌻', '雪', '猫', '猫'], k: 2 },
    expected: { start: 0, endExclusive: 3 },
  },
  {
    id: 'empty-string-identifier',
    name: 'treats an empty string as an event identifier',
    input: { events: ['', 'A', '', 'B'], k: 2 },
    expected: { start: 0, endExclusive: 3 },
  },
  {
    id: 'visually-similar-unicode-identifiers',
    name: 'does not normalize visually similar Unicode identifiers',
    input: { events: ['é', 'e\u0301'], k: 1 },
    expected: { start: 0, endExclusive: 1 },
  },
  {
    id: 'window-shrinks-after-new-identifiers',
    name: 'shrinks from the left until the window is valid again',
    input: { events: ['A', 'B', 'C', 'C', 'B', 'A'], k: 2 },
    expected: { start: 1, endExclusive: 5 },
  },
] as const;
