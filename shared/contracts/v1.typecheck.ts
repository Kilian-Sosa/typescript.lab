import { CONTRACT_VERSION } from './v1.js';
import type {
  AttemptEvaluation,
  ChallengeCase,
  ChallengeDefinition,
  CompletedRunStatus,
  CreateAttemptInput,
  RunResult,
  RunStatus,
  SaveDraftInput,
  SolutionAttempt,
  SolutionDraft,
} from './v1.js';

type WindowInput = { events: string[]; k: number };
type WindowOutput = { start: number; endExclusive: number };

const example = {
  id: 'earliest-tie',
  name: 'Choose the earliest window on equal lengths',
  input: { events: ['A', 'B', 'A', 'C', 'B', 'B'], k: 2 },
  expected: { start: 0, endExclusive: 3 },
} satisfies ChallengeCase<WindowInput, WindowOutput>;

const definition = {
  id: 'longest-window',
  slug: 'longest-window',
  version: '1.0.0',
  title: 'Longest Window with K Distinct Events',
  objective: 'Find the longest contiguous window containing at most k distinct IDs.',
  difficulty: 'medium',
  estimatedMinutes: 25,
  tags: ['sliding-window'],
  signature: 'longestWindow(events: string[], k: number): { start: number; endExclusive: number }',
  entryPoint: 'longestWindow',
  parameterNames: ['events', 'k'],
  statementPath: 'challenges/longest-window/README.md',
  starterPath: 'challenges/longest-window/starter.ts',
  constraints: ['Choose the earliest start on ties.'],
  edgeCases: ['Empty events or nonpositive k return an empty window.'],
  cases: [example],
  exampleCaseIds: [example.id],
  learning: {
    hints: ['First progressive hint', 'Second progressive hint', 'Third progressive hint'],
    explanationPath: 'challenges/longest-window/README.md',
    solutionPath: 'challenges/longest-window/solution.ts',
  },
} satisfies ChallengeDefinition<WindowInput, WindowOutput>;

const statuses = {
  'not-run': true,
  running: true,
  passed: true,
  failed: true,
  'compile-error': true,
  timeout: true,
  'execution-error': true,
  'infrastructure-error': true,
} satisfies Record<RunStatus, true>;

const run = {
  contractVersion: CONTRACT_VERSION,
  runId: 'fixture-run-1',
  challengeId: definition.id,
  challengeVersion: definition.version,
  sourceRevision: 1,
  status: 'failed',
  cases: [{ caseId: example.id, status: 'failed', expected: example.expected, actual: null }],
  diagnostics: [],
} satisfies RunResult;

const completedStatuses = {
  passed: true,
  failed: true,
  'compile-error': true,
  timeout: true,
  'execution-error': true,
  'infrastructure-error': true,
} satisfies Record<CompletedRunStatus, true>;

const draft: SolutionDraft = {
  userId: 'fixture-owner',
  challengeId: definition.id,
  challengeVersion: definition.version,
  source: '// User source snapshot',
  revision: 0,
  updatedAt: '2026-10-16T00:00:00.000Z',
};

const insertDraft: SaveDraftInput = {
  challengeId: draft.challengeId,
  challengeVersion: draft.challengeVersion,
  source: draft.source,
  expectedRevision: null,
};
const updateDraft: SaveDraftInput = { ...insertDraft, expectedRevision: 0 };

const attemptInput: CreateAttemptInput = {
  challengeId: draft.challengeId,
  challengeVersion: draft.challengeVersion,
  source: draft.source,
  notes: '',
  timeComplexity: null,
  spaceComplexity: null,
  testSummary: { status: 'untested' },
};
const attempt: SolutionAttempt = {
  ...attemptInput,
  id: 'fixture-attempt',
  userId: draft.userId,
  createdAt: draft.updatedAt,
};
const failedAttempt: CreateAttemptInput = {
  ...attemptInput,
  testSummary: { status: 'failed', totalCases: 1, passedCases: 0 },
};

// Negative checks fail compilation if the contract stops enforcing these boundaries.
const malformedCase: ChallengeCase<WindowInput, WindowOutput> = {
  ...example,
  // @ts-expect-error The output must preserve the challenge's declared return shape.
  expected: { start: 0 },
};
const malformedInput: ChallengeCase<WindowInput, WindowOutput> = {
  ...example,
  // @ts-expect-error A named number input cannot contain a string.
  input: { events: [], k: '2' },
};
const invalidParameters: ChallengeDefinition<WindowInput, WindowOutput> = {
  ...definition,
  // @ts-expect-error Entry-point parameter names must refer to named inputs.
  parameterNames: ['unknown'],
};
const missingHints: ChallengeDefinition<WindowInput, WindowOutput> = {
  ...definition,
  learning: {
    ...definition.learning,
    // @ts-expect-error The learning contract requires exactly three progressive hints.
    hints: ['Only one hint'],
  },
};
const ownerSuppliedDraft: SaveDraftInput = {
  ...insertDraft,
  // @ts-expect-error A draft write input does not accept an authorization identity.
  userId: 'another-owner',
};
const ownerSuppliedAttempt: CreateAttemptInput = {
  ...attemptInput,
  // @ts-expect-error An attempt write input does not accept an authorization identity.
  userId: 'another-owner',
};
// @ts-expect-error Historical source is an immutable snapshot.
attempt.source = 'replacement';
// @ts-expect-error Historical notes are an immutable snapshot.
attempt.notes = 'replacement';
// @ts-expect-error Historical challenge context cannot be rewritten.
attempt.challengeVersion = '2.0.0';
// @ts-expect-error Historical evaluation cannot be changed in place.
attempt.testSummary.status = 'passed';
// @ts-expect-error Pending work is not a completed submission evaluation.
const runningEvaluation: AttemptEvaluation = { status: 'running', totalCases: 1, passedCases: 0 };
// @ts-expect-error A never-started run is persisted as untested, not not-run.
const neverRunEvaluation: AttemptEvaluation = { status: 'not-run', totalCases: 1, passedCases: 0 };
const wrongVersion: RunResult = {
  ...run,
  // @ts-expect-error Cross-version runner messages must not silently enter v1 consumers.
  contractVersion: '2.0.0',
};

void [statuses, completedStatuses, updateDraft, attempt, failedAttempt, malformedCase,
  malformedInput, invalidParameters, missingHints, ownerSuppliedDraft, ownerSuppliedAttempt,
  runningEvaluation, neverRunEvaluation, wrongVersion];
