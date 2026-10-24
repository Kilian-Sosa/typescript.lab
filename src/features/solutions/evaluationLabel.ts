import type { AttemptEvaluation } from '../../../shared/contracts/v1';

export function evaluationLabel(evaluation: AttemptEvaluation): string {
  return evaluation.status === 'untested'
    ? 'Untested'
    : `${evaluation.status} · ${evaluation.passedCases}/${evaluation.totalCases} cases`;
}
