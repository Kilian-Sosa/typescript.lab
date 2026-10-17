import { describe, expect, it } from 'vitest';
import { longestWindowSteps } from './longestWindowSteps';
import { longestWindowCases } from '../../../challenges/longest-window/cases';

describe('longestWindowSteps', () => {
  it.each(longestWindowCases)('ends at the published range for $id and preserves pointer/count invariants', ({ input, expected }) => {
    const steps = longestWindowSteps(input.events, input.k);
    const finalStep = steps.at(-1)!;
    expect({ start: finalStep.bestStart, endExclusive: finalStep.bestEndExclusive }).toEqual(expected);
    for (const step of steps) {
      expect(step.left).toBeGreaterThanOrEqual(0);
      expect(step.left).toBeLessThanOrEqual(step.right + 1);
      expect(step.right).toBeLessThan(input.events.length || 1);
      const currentEvents = input.events.slice(step.left, step.right + 1);
      expect(Object.values(step.counts).reduce((sum, count) => sum + count, 0)).toBe(currentEvents.length);
      for (const [event, count] of Object.entries(step.counts)) {
        expect(count).toBe(currentEvents.filter((value) => value === event).length);
      }
    }
  });

  it('records pointer movement, counts, and best-range updates for each reference step', () => {
    const steps = longestWindowSteps(['A', 'B', 'A', 'C'], 2);

    expect(steps.map(({ left, right, counts, bestStart, bestEndExclusive }) => ({
      left,
      right,
      counts: { ...counts },
      bestStart,
      bestEndExclusive,
    }))).toEqual([
      { left: 0, right: -1, counts: {}, bestStart: 0, bestEndExclusive: 0 },
      { left: 0, right: 0, counts: { A: 1 }, bestStart: 0, bestEndExclusive: 1 },
      { left: 0, right: 1, counts: { A: 1, B: 1 }, bestStart: 0, bestEndExclusive: 2 },
      { left: 0, right: 2, counts: { A: 2, B: 1 }, bestStart: 0, bestEndExclusive: 3 },
      { left: 0, right: 3, counts: { A: 2, B: 1, C: 1 }, bestStart: 0, bestEndExclusive: 3 },
      { left: 1, right: 3, counts: { A: 1, B: 1, C: 1 }, bestStart: 0, bestEndExclusive: 3 },
      { left: 2, right: 3, counts: { A: 1, C: 1 }, bestStart: 0, bestEndExclusive: 3 },
    ]);
    expect(steps.at(-1)?.explanation).toMatch(/window is valid again.*best range/i);
  });

  it('keeps the earliest best range when later windows tie in length', () => {
    const steps = longestWindowSteps(['A', 'B', 'C', 'A'], 2);

    expect(steps.at(-1)).toMatchObject({ bestStart: 0, bestEndExclusive: 2 });
    expect(steps.at(-1)?.explanation).toMatch(/same length.*earlier/i);
  });

  it('returns an empty trace state for empty input', () => {
    expect(longestWindowSteps([], 2)).toEqual([{
      left: 0,
      right: -1,
      counts: {},
      bestStart: 0,
      bestEndExclusive: 0,
      explanation: expect.stringMatching(/no events/i),
    }]);
  });

  it.each([0, -1])('returns before scanning when k is %s', (k) => {
    const steps = longestWindowSteps(['A', 'B'], k);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      left: 0,
      right: -1,
      counts: {},
      bestStart: 0,
      bestEndExclusive: 0,
    });
    expect(steps[0]?.explanation).toMatch(/k.*not positive/i);
  });

  it('uses only whole distinct identifiers for a positive fractional limit', () => {
    const steps = longestWindowSteps(['A', 'B', 'A'], 1.5);

    expect(steps.at(-1)).toMatchObject({
      left: 2,
      right: 2,
      counts: { A: 1 },
      bestStart: 0,
      bestEndExclusive: 1,
    });
  });

  it('handles Unicode and prototype-named identifiers as ordinary exact keys', () => {
    const prototypeTrace = longestWindowSteps(['__proto__', 'constructor', '__proto__'], 2);
    const prototypeSnapshot = prototypeTrace.at(-1);
    const unicodeTrace = longestWindowSteps(['é', 'e\\u0301'], 1);
    const unicodeSnapshot = unicodeTrace.at(-1);

    expect(prototypeSnapshot?.counts['__proto__']).toBe(2);
    expect(prototypeSnapshot?.counts.constructor).toBe(1);
    expect(Object.getPrototypeOf(prototypeSnapshot?.counts)).toBeNull();
    expect(unicodeSnapshot?.counts['é']).toBeUndefined();
    expect(unicodeSnapshot?.counts['e\\u0301']).toBe(1);
    expect(unicodeSnapshot).toMatchObject({ bestStart: 0, bestEndExclusive: 1 });
  });

  it('keeps prior snapshot counts independent and freezes the trace', () => {
    const steps = longestWindowSteps(['A', 'A', 'B'], 1);

    expect(steps[1]?.counts).toMatchObject({ A: 1 });
    expect(steps[2]?.counts).toMatchObject({ A: 2 });
    expect(Object.isFrozen(steps)).toBe(true);
    expect(Object.isFrozen(steps[1])).toBe(true);
    expect(Object.isFrozen(steps[1]?.counts)).toBe(true);
  });
});
