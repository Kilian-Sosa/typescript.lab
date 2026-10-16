export const CONTRACT_VERSION = '1.0.0' as const;

export type JsonValue = null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ChallengeSummary {
  readonly id: string;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly objective: string;
  readonly difficulty: Difficulty;
  readonly estimatedMinutes: number;
  readonly tags: readonly string[];
}

export interface ChallengeCase<
  Input extends { readonly [key: string]: JsonValue } = { readonly [key: string]: JsonValue },
  Output extends JsonValue = JsonValue,
> {
  readonly id: string;
  readonly name: string;
  readonly input: Input;
  readonly expected: Output;
}

export interface ChallengeDefinition<
  Input extends { readonly [key: string]: JsonValue } = { readonly [key: string]: JsonValue },
  Output extends JsonValue = JsonValue,
> extends ChallengeSummary {
  readonly signature: string;
  readonly entryPoint: string;
  readonly parameterNames: readonly (keyof Input & string)[];
  readonly statementPath: string;
  readonly starterPath: string;
  readonly constraints: readonly string[];
  readonly edgeCases: readonly string[];
  readonly cases: readonly ChallengeCase<Input, Output>[];
  readonly exampleCaseIds: readonly string[];
  readonly learning: {
    readonly hints: readonly [string, string, string];
    readonly explanationPath: string;
    readonly solutionPath: string;
  };
}

export type RunStatus = 'not-run' | 'running' | 'passed' | 'failed'
  | 'compile-error' | 'timeout' | 'execution-error' | 'infrastructure-error';
export type CompletedRunStatus = Exclude<RunStatus, 'not-run' | 'running'>;

export interface CaseResult {
  readonly caseId: string;
  readonly status: 'not-run' | 'passed' | 'failed' | 'timeout' | 'execution-error';
  readonly expected?: JsonValue;
  readonly actual?: JsonValue;
  readonly message?: string;
}

export interface RunResult {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly runId: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly sourceRevision: number;
  readonly status: RunStatus;
  readonly cases: readonly CaseResult[];
  readonly diagnostics: readonly string[];
  readonly reason?: 'unsupported-code' | 'policy-rejected' | 'runtime-error' | 'cancelled';
}

export interface RunResultSummary {
  readonly status: CompletedRunStatus;
  readonly totalCases: number;
  readonly passedCases: number;
}
export type AttemptEvaluation = RunResultSummary | { readonly status: 'untested' };

export interface SolutionDraft {
  readonly userId: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface SaveDraftInput {
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly expectedRevision: number | null;
}

export interface CreateAttemptInput {
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly notes: string;
  readonly timeComplexity: string | null;
  readonly spaceComplexity: string | null;
  readonly testSummary: AttemptEvaluation;
}

export interface SolutionAttempt extends CreateAttemptInput {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
}
