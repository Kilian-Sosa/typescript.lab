import { describe, expect, it } from 'vitest';
import type { SolutionAttempt } from '../../../shared/contracts/v1';
import {
  exportAttempts,
  exportAttemptsJson,
  parsePortableAttemptJson,
  parsePortableAttemptsJson,
} from './exportAttempts';

const attempt: SolutionAttempt = {
  id: 'b3a6b4b1-0000-4000-8000-000000000011',
  userId: 'private-account-id',
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: 'const answer = "π";\nconsole.log(answer);\n',
  notes: 'I moved the left edge only after removing the old value.\nKeep this insight.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(k)',
  testSummary: { status: 'failed', totalCases: 5, passedCases: 4 },
  createdAt: '2026-10-17T10:30:00.000Z',
};

describe('exportAttempts', () => {
  it('creates exact source, readable Markdown, and a portable JSON round trip', () => {
    const [files] = exportAttempts([attempt]);

    expect(files?.typescript.content).toBe(attempt.source);
    expect(files?.typescript.name).toMatch(/\.ts$/);
    expect(files?.markdown.content).toContain('Challenge version: `1.0.0`');
    expect(files?.markdown.content).toContain(attempt.notes);
    expect(files?.markdown.content).toContain(attempt.source);
    expect(files?.json.content).not.toContain('private-account-id');
    expect(parsePortableAttemptJson(files?.json.content ?? '')).toEqual({
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
    });
  });

  it('uses safe unique names and keeps an empty export empty', () => {
    const files = exportAttempts([attempt, { ...attempt, id: 'second-attempt', source: 'export {};' }]);

    expect(files).toHaveLength(2);
    expect(files[0]?.typescript.name).not.toContain('..');
    expect(files[0]?.typescript.name).not.toContain('/');
    expect(files[0]?.typescript.name).not.toBe(files[1]?.typescript.name);
    expect(exportAttempts([])).toEqual([]);
  });

  it('round trips every attempt in the notebook collection without account identifiers', () => {
    const json = exportAttemptsJson([attempt, { ...attempt, id: 'attempt-2' }]);
    const portable = parsePortableAttemptsJson(json);

    expect(portable.formatVersion).toBe(1);
    expect(portable.attempts).toHaveLength(2);
    expect(portable.attempts[0]?.source).toBe(attempt.source);
    expect(portable.attempts[1]?.notes).toBe(attempt.notes);
    expect(json).not.toContain('private-account-id');
  });

  it('rejects malformed portable JSON instead of exporting a partial record', () => {
    expect(() => parsePortableAttemptJson('{"formatVersion":1,"attempt":{}}')).toThrow(
      /does not match the portable attempt format/i,
    );
  });
});
