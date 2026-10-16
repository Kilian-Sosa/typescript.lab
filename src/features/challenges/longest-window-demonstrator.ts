import type { LongestWindowInput, LongestWindowOutput } from '../../../challenges/longest-window/cases';
import { longestWindow } from '../../../challenges/longest-window/solution';

/** Runs the canonical function only for the independent example-input preview. */
export function demonstrateLongestWindow(
  input: LongestWindowInput,
): LongestWindowOutput {
  return longestWindow([...input.events], input.k);
}
