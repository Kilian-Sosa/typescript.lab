import type { RunResultSummary } from '../../../shared/contracts/v1';
import { validResult, type RunFeedback } from './runChallenge';

// Transient evaluation binding; persistence receives only summary fields from this object.
export interface SourceEvaluation {
  readonly source: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly sourceRevision: number;
  readonly workspaceRevision: number;
  readonly summary: RunResultSummary;
}

export function summarizeRun(feedback: RunFeedback): RunResultSummary | null {
  const { consoleOutput: _console, ...result } = feedback;
  if (
    !validResult(result) ||
    result.status === 'not-run' ||
    result.status === 'running' ||
    result.reason === 'cancelled'
  )
    return null;
  return {
    status: result.status,
    totalCases: result.cases.length,
    passedCases: result.cases.filter((c) => c.status === 'passed').length,
  };
}
