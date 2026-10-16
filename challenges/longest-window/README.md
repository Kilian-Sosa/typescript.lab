# Longest Window with Limited Event Types

Given an array of event identifiers and a finite numeric limit `k`, return the longest contiguous range containing at most `k` distinct identifiers. Return its start index and its exclusive end index. Since the number of distinct identifiers is an integer, a positive fractional `k` allows at most the greatest whole number not larger than `k`.

If multiple ranges share the maximum length, return the one with the smallest start index. Return `{ start: 0, endExclusive: 0 }` when the array is empty or `k` is non-positive.

## Function contract

```ts
function longestWindow(
  events: string[],
  k: number,
): { start: number; endExclusive: number }
```

Indices are zero-based. `endExclusive` is the index immediately after the last event in the selected range. Event identifiers are compared by their exact string values: comparison is case-sensitive and does not normalize Unicode. An empty string is a valid identifier.

## Example

```ts
events = ['A', 'B', 'A', 'C', 'B', 'B'];
k = 2;
```

The result is:

```ts
{ start: 0, endExclusive: 3 }
```

The range at indices `0..3` and the range at indices `3..6` both have length three and contain two distinct identifiers. The earlier range wins.

## Additional examples

```ts
longestWindow([], 2);                 // { start: 0, endExclusive: 0 }
longestWindow(['A', 'B'], 0);         // { start: 0, endExclusive: 0 }
longestWindow(['A', 'B', 'A'], 3);    // { start: 0, endExclusive: 3 }
longestWindow(['A', 'B'], 0.5);      // { start: 0, endExclusive: 0 }
longestWindow(['', 'A', '', 'B'], 2); // { start: 0, endExclusive: 3 }
```

## Constraints and edge cases

- `events` contains between 0 and 100,000 strings.
- `k` is finite and may be negative, fractional, zero, or larger than the number of events.
- Empty arrays and non-positive `k` produce the empty range.
- When `k` is at least the number of distinct identifiers, the entire array is the answer.
- Unicode strings and empty strings are valid event identifiers.
- Equal-length answers use the earliest start index.

## Portable tests

The canonical tests and challenge examples use the same fixtures from `cases.ts`. Run the canonical suite with:

```sh
pnpm vitest run challenges/longest-window/solution.test.ts
```

`practice.test.ts` exercises the intentionally incomplete `starter.ts` and is excluded from the default CI suite. After integration, use the opt-in practice config:

```sh
pnpm vitest run --config vitest.practice.config.ts challenges/longest-window/practice.test.ts
```

The practice suite is expected to fail until the learner replaces the starter's TODO. The practice config is owned by the coordinator because the default Vitest config intentionally excludes this file.
