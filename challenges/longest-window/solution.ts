export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } {
  if (k <= 0) {
    return { start: 0, endExclusive: 0 };
  }

  const frequencies = new Map<string, number>();
  let windowStart = 0;
  let bestStart = 0;
  let bestEndExclusive = 0;

  for (let right = 0; right < events.length; right += 1) {
    const event = events[right]!;
    frequencies.set(event, (frequencies.get(event) ?? 0) + 1);

    while (frequencies.size > k) {
      const leavingEvent = events[windowStart]!;
      const remainingCount = frequencies.get(leavingEvent)! - 1;

      if (remainingCount === 0) {
        frequencies.delete(leavingEvent);
      } else {
        frequencies.set(leavingEvent, remainingCount);
      }

      windowStart += 1;
    }

    const currentEndExclusive = right + 1;
    if (currentEndExclusive - windowStart > bestEndExclusive - bestStart) {
      bestStart = windowStart;
      bestEndExclusive = currentEndExclusive;
    }
  }

  return { start: bestStart, endExclusive: bestEndExclusive };
}
