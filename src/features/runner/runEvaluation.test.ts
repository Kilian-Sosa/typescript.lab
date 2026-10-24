import { describe, expect, it } from 'vitest';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import type { RunFeedback } from './runChallenge';
import { summarizeRun } from './runEvaluation';

function completed(status: RunFeedback['status'] = 'passed'): RunFeedback {
  return {
    contractVersion: '1.0.0',
    runId: 'evaluation-run',
    sourceRevision: 2,
    challengeId: 'longest-window',
    challengeVersion: '1.0.0',
    status,
    diagnostics: status === 'passed' || status === 'failed' ? [] : ['Execution diagnostic'],
    cases: longestWindowCases.map((c, i) => ({
      caseId: c.id,
      status:
        status === 'passed' || status === 'failed' ? (status === 'failed' && i === 0 ? 'failed' : 'passed') : 'not-run',
      ...(status === 'passed' || status === 'failed'
        ? { expected: c.expected, actual: status === 'failed' && i === 0 ? null : c.expected }
        : {}),
    })),
  };
}

describe('completed evaluation projection', () => {
  it.each([
    ['passed', 14],
    ['failed', 13],
    ['compile-error', 0],
    ['timeout', 0],
    ['execution-error', 0],
    ['infrastructure-error', 0],
  ] as const)('retains truthful %s status and canonical counts', (status, passedCases) => {
    expect(summarizeRun(completed(status))).toEqual({ status, totalCases: 14, passedCases });
  });

  it('retains policy failures and excludes logs/diagnostics from stored summaries', () => {
    expect(
      summarizeRun({
        ...completed('execution-error'),
        reason: 'policy-rejected',
        consoleOutput: { entries: [], truncated: false },
      }),
    ).toEqual({ status: 'execution-error', totalCases: 14, passedCases: 0 });
  });

  it('does not persist transient or cancelled execution as a completed evaluation', () => {
    expect(summarizeRun(completed('running'))).toBeNull();
    expect(summarizeRun(completed('not-run'))).toBeNull();
    expect(summarizeRun({ ...completed('execution-error'), reason: 'cancelled' })).toBeNull();
  });

  it('rejects empty, incomplete, duplicate, forged and contradictory passing results', () => {
    const pass = completed();
    for (const cases of [
      [],
      pass.cases.slice(1),
      pass.cases.map(() => pass.cases[0]!),
      pass.cases.map((c, i) => (i === 0 ? { ...c, actual: null } : c)),
      pass.cases.map((c, i) => (i === 0 ? { ...c, expected: null, actual: null } : c)),
    ]) {
      expect(summarizeRun({ ...pass, cases })).toBeNull();
    }
    expect(summarizeRun({ ...pass, status: 'failed' })).toBeNull();
  });
});
