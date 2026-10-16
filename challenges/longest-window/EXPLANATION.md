# Reference explanation

Maintain a contiguous range with a left edge, a right edge, and a frequency map for the event identifiers in that range. The map's size is the number of distinct identifiers.

Extend the right edge one event at a time and increment its count. If the map now contains more than `k` identifiers, move the left edge forward until the range is valid again. Decrement each departing event's count and delete its key when that count reaches zero.

Once the range is valid, compare its length with the longest range seen so far. Update the answer only when the new range is strictly longer. The left edge never moves backward, so equal-length candidates are encountered in start-index order; keeping the first one implements the earliest-start tie rule.

For an empty array, the best range remains `[0, 0)`. For `k <= 0`, return that range before scanning because no non-empty range can satisfy the distinct-identifier limit.

## Correctness

After processing each right edge, the range maintained by the algorithm contains at most `k` distinct identifiers. Shrinking only from the left is sufficient because any longer range ending at the current right edge and starting before the maintained left edge would contain every identifier in the maintained range plus the identifier that forced the shrink, so it would also be invalid.

Every valid candidate can be considered when its right edge is processed: the maintained range is the longest valid range ending at that position. Comparing those candidates therefore finds a maximum-length valid range. Updating only on a strict length increase preserves the first, and thus earliest-start, maximum.

## Complexity

The right edge advances once per event. The left edge also advances at most once per event. With average constant-time map operations, the algorithm takes O(n) time and O(d) additional space, where n is the number of events and d is the number of distinct identifiers in the active range.
