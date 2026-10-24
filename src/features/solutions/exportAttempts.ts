import type { AttemptEvaluation, SolutionAttempt } from '../../../shared/contracts/v1';

export interface AttemptExportFile {
  readonly name: string;
  readonly content: string;
  readonly mediaType: 'text/typescript' | 'text/markdown' | 'application/json';
}

export interface AttemptExportFiles {
  readonly typescript: AttemptExportFile;
  readonly markdown: AttemptExportFile;
  readonly json: AttemptExportFile;
}

export interface PortableAttempt {
  readonly id: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly notes: string;
  readonly timeComplexity: string | null;
  readonly spaceComplexity: string | null;
  readonly testSummary: AttemptEvaluation;
  readonly createdAt: string;
}

export interface PortableAttemptDocument {
  readonly formatVersion: 1;
  readonly attempt: PortableAttempt;
}

export interface PortableAttemptCollection {
  readonly formatVersion: 1;
  readonly attempts: readonly PortableAttempt[];
}

export class PortableAttemptFormatError extends Error {
  constructor() {
    super('The file does not match the portable attempt format.');
    this.name = 'PortableAttemptFormatError';
  }
}

function safeFilePart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'attempt'
  );
}

function codeFence(source: string): string {
  const fences = source.match(/`+/g) ?? [];
  const longest = fences.reduce((length, current) => Math.max(length, current.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function portableAttempt(attempt: SolutionAttempt): PortableAttempt {
  return {
    id: attempt.id,
    challengeId: attempt.challengeId,
    challengeVersion: attempt.challengeVersion,
    source: attempt.source,
    notes: attempt.notes,
    timeComplexity: attempt.timeComplexity,
    spaceComplexity: attempt.spaceComplexity,
    testSummary: attempt.testSummary,
    createdAt: attempt.createdAt,
  };
}

function evaluationLabel(evaluation: AttemptEvaluation): string {
  if (evaluation.status === 'untested') {
    return 'Untested';
  }
  return `${evaluation.status} (${evaluation.passedCases}/${evaluation.totalCases} cases passed)`;
}

function markdownContent(attempt: PortableAttempt): string {
  const fence = codeFence(attempt.source);
  const timeComplexity = attempt.timeComplexity ?? 'Not recorded';
  const spaceComplexity = attempt.spaceComplexity ?? 'Not recorded';
  const notes = attempt.notes.length > 0 ? attempt.notes : '_No learning notes were saved._';

  return [
    `# ${attempt.challengeId} attempt`,
    '',
    `- Challenge version: \`${attempt.challengeVersion}\``,
    `- Submitted: ${attempt.createdAt}`,
    `- Test status: ${evaluationLabel(attempt.testSummary)}`,
    `- Declared time complexity: ${timeComplexity}`,
    `- Declared space complexity: ${spaceComplexity}`,
    '',
    '## Learning notes',
    '',
    notes,
    '',
    '## Source',
    '',
    `${fence}ts`,
    attempt.source,
    `${fence}`,
    '',
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEvaluation(value: unknown): value is AttemptEvaluation {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status === 'untested') {
    return Object.keys(value).length === 1;
  }
  const validStatuses = ['passed', 'failed', 'compile-error', 'timeout', 'execution-error', 'infrastructure-error'];
  return (
    typeof value.status === 'string' &&
    validStatuses.includes(value.status) &&
    Number.isSafeInteger(value.totalCases) &&
    Number.isSafeInteger(value.passedCases) &&
    (value.totalCases as number) >= 0 &&
    (value.passedCases as number) >= 0 &&
    (value.passedCases as number) <= (value.totalCases as number) &&
    Object.keys(value).every((key) => ['status', 'totalCases', 'passedCases'].includes(key)) &&
    (value.status !== 'passed' || ((value.totalCases as number) > 0 && value.totalCases === value.passedCases))
  );
}

function decodePortableDocument(value: unknown): PortableAttemptDocument {
  if (!isRecord(value) || value.formatVersion !== 1 || !isRecord(value.attempt)) {
    throw new PortableAttemptFormatError();
  }

  const attempt = value.attempt;
  const expectedKeys = [
    'id',
    'challengeId',
    'challengeVersion',
    'source',
    'notes',
    'timeComplexity',
    'spaceComplexity',
    'testSummary',
    'createdAt',
  ];
  if (
    Object.keys(value).length !== 2 ||
    Object.keys(attempt).length !== expectedKeys.length ||
    Object.keys(attempt).some((key) => !expectedKeys.includes(key)) ||
    typeof attempt.id !== 'string' ||
    typeof attempt.challengeId !== 'string' ||
    typeof attempt.challengeVersion !== 'string' ||
    typeof attempt.source !== 'string' ||
    typeof attempt.notes !== 'string' ||
    (attempt.timeComplexity !== null && typeof attempt.timeComplexity !== 'string') ||
    (attempt.spaceComplexity !== null && typeof attempt.spaceComplexity !== 'string') ||
    typeof attempt.createdAt !== 'string' ||
    !isEvaluation(attempt.testSummary)
  ) {
    throw new PortableAttemptFormatError();
  }

  return {
    formatVersion: 1,
    attempt: {
      id: attempt.id,
      challengeId: attempt.challengeId,
      challengeVersion: attempt.challengeVersion,
      source: attempt.source,
      notes: attempt.notes,
      timeComplexity: attempt.timeComplexity,
      spaceComplexity: attempt.spaceComplexity,
      testSummary: attempt.testSummary,
      createdAt: attempt.createdAt,
    },
  };
}

export function exportAttempts(attempts: readonly SolutionAttempt[]): AttemptExportFiles[] {
  return attempts.map((attempt) => {
    const portable = portableAttempt(attempt);
    const fileStem = `attempt-${safeFilePart(attempt.challengeId)}-${safeFilePart(attempt.id)}`;
    const document: PortableAttemptDocument = { formatVersion: 1, attempt: portable };

    return {
      typescript: {
        name: `${fileStem}.ts`,
        content: attempt.source,
        mediaType: 'text/typescript',
      },
      markdown: {
        name: `${fileStem}.md`,
        content: markdownContent(portable),
        mediaType: 'text/markdown',
      },
      json: {
        name: `${fileStem}.json`,
        content: `${JSON.stringify(document, null, 2)}\n`,
        mediaType: 'application/json',
      },
    };
  });
}

export function parsePortableAttemptJson(json: string): PortableAttemptDocument {
  try {
    return decodePortableDocument(JSON.parse(json) as unknown);
  } catch (error) {
    if (error instanceof PortableAttemptFormatError) {
      throw error;
    }
    throw new PortableAttemptFormatError();
  }
}

export function exportAttemptsJson(attempts: readonly SolutionAttempt[]): string {
  const collection: PortableAttemptCollection = {
    formatVersion: 1,
    attempts: attempts.map(portableAttempt),
  };
  return `${JSON.stringify(collection, null, 2)}\n`;
}

export function parsePortableAttemptsJson(json: string): PortableAttemptCollection {
  try {
    const value = JSON.parse(json) as unknown;
    if (
      !isRecord(value) ||
      value.formatVersion !== 1 ||
      !Array.isArray(value.attempts) ||
      Object.keys(value).length !== 2
    ) {
      throw new PortableAttemptFormatError();
    }
    const attempts = value.attempts.map(
      (attempt) =>
        decodePortableDocument({
          formatVersion: 1,
          attempt,
        }).attempt,
    );
    return { formatVersion: 1, attempts };
  } catch (error) {
    if (error instanceof PortableAttemptFormatError) {
      throw error;
    }
    throw new PortableAttemptFormatError();
  }
}
