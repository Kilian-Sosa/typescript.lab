export interface StepSnapshot {
  readonly left: number;
  /** The index currently under the right pointer, or -1 before scanning. */
  readonly right: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly bestStart: number;
  readonly bestEndExclusive: number;
  readonly explanation: string;
}

/**
 * Builds an immutable trace of the canonical longest-window reference algorithm.
 * The snapshots describe this reference algorithm; they never inspect learner code.
 */
export function longestWindowSteps(
  events: readonly string[],
  k: number,
): readonly StepSnapshot[] {
  const counts = new Map<string, number>();
  const snapshots: StepSnapshot[] = [];
  let left = 0;
  let right = -1;
  let bestStart = 0;
  let bestEndExclusive = 0;

  function addSnapshot(explanation: string): void {
    const snapshotCounts = Object.create(null) as Record<string, number>;
    for (const [event, count] of counts) {
      snapshotCounts[event] = count;
    }

    snapshots.push(Object.freeze({
      left,
      right,
      counts: Object.freeze(snapshotCounts),
      bestStart,
      bestEndExclusive,
      explanation,
    }));
  }

  if (k <= 0) {
    addSnapshot('k is not positive, so the reference solution returns an empty range without scanning events.');
    return Object.freeze(snapshots);
  }

  if (events.length === 0) {
    addSnapshot('There are no events to scan, so the best range remains empty.');
    return Object.freeze(snapshots);
  }

  addSnapshot('Start before the first event with an empty window and an empty best range.');

  for (let index = 0; index < events.length; index += 1) {
    right = index;
    const event = events[index]!;
    counts.set(event, (counts.get(event) ?? 0) + 1);

    if (counts.size > k) {
      addSnapshot(
        `Include event ${JSON.stringify(event)} at index ${right}; the window now has ${counts.size} distinct identifiers, more than k allows. Move the left pointer until it is valid again.`,
      );

      while (counts.size > k) {
        const leavingIndex = left;
        const leavingEvent = events[left]!;
        const remainingCount = counts.get(leavingEvent)! - 1;
        if (remainingCount === 0) {
          counts.delete(leavingEvent);
        } else {
          counts.set(leavingEvent, remainingCount);
        }
        left += 1;

        if (counts.size > k) {
          addSnapshot(
            `Move the left pointer past ${JSON.stringify(leavingEvent)} at index ${leavingIndex}; ${counts.size} distinct identifiers remain, so the window is still over the limit.`,
          );
        } else {
          updateBestAndSnapshot(
            `Move the left pointer past ${JSON.stringify(leavingEvent)} at index ${leavingIndex}; the window is valid again.`,
          );
        }
      }
    } else {
      updateBestAndSnapshot(`Include event ${JSON.stringify(event)} at index ${right}; the window is valid.`);
    }
  }

  return Object.freeze(snapshots);

  function updateBestAndSnapshot(explanation: string): void {
    const endExclusive = right + 1;
    const windowLength = endExclusive - left;
    const bestLength = bestEndExclusive - bestStart;
    let nextExplanation: string;

    if (windowLength > bestLength) {
      bestStart = left;
      bestEndExclusive = endExclusive;
      nextExplanation = `${explanation} Its length exceeds the best so far, so the best range becomes [${bestStart}, ${bestEndExclusive}).`;
    } else if (windowLength === bestLength) {
      nextExplanation = `${explanation} It has the same length as the best range, so keep the earlier range [${bestStart}, ${bestEndExclusive}).`;
    } else {
      nextExplanation = `${explanation} It is shorter than the best range [${bestStart}, ${bestEndExclusive}), so the best stays the same.`;
    }

    addSnapshot(nextExplanation);
  }
}