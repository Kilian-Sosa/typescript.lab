import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftRecovery, type LocalDraftBuffer } from './draftRecovery';

const buffer = { ownerId: 'a', challengeId: 'challenge', challengeVersion: '1', source: 'source',
  expectedRevision: 0, dirty: true, notes: '', timeComplexity: '', spaceComplexity: '' };
beforeEach(() => localStorage.clear());

describe('distinct local recovery content', () => {
  it('reuses an immutable archive despite synchronization metadata changes', () => {
    const recovery = createDraftRecovery(localStorage, 'current');
    recovery.archive(buffer);
    recovery.archive({ ...buffer, expectedRevision: 5, dirty: false });
    expect(localStorage.length).toBe(1);
    expect(recovery.others('a', 'challenge')).toHaveLength(1);
  });

  it('retains every source, note, complexity, version and owner variant', () => {
    const recovery = createDraftRecovery(localStorage, 'current');
    for (const variant of [buffer, { ...buffer, source: 'source ' }, { ...buffer, notes: 'note' },
      { ...buffer, dirty: false, timeComplexity: 'O(n)' }, { ...buffer, dirty: false, spaceComplexity: 'O(n)' },
      { ...buffer, challengeVersion: '2' }, { ...buffer, ownerId: 'b' }, { ...buffer, challengeId: 'other' }]) recovery.archive(variant);
    expect(localStorage.length).toBe(8);
    expect(recovery.others('a', 'challenge')).toHaveLength(6);
    expect(recovery.others('b', 'challenge')).toHaveLength(1);
    expect(recovery.others('a', 'other')).toHaveLength(1);
  });

  it('groups legacy duplicates without deleting them and archives independently of mutable tabs', () => {
    const other = createDraftRecovery(localStorage, 'other');
    other.write(buffer);
    for (const tabId of ['archive-old1', 'archive-old2']) {
      const row: LocalDraftBuffer = { ...buffer, tabId, updatedAt: 1 };
      localStorage.setItem(`typescript-lab-buffer-v1:${JSON.stringify(['a', 'challenge', tabId])}`, JSON.stringify(row));
    }
    const recovery = createDraftRecovery(localStorage, 'current');
    expect(recovery.others('a', 'challenge')).toHaveLength(1);
    expect(localStorage.length).toBe(3);
    recovery.archive({ ...buffer, source: 'unique live' });
    other.write({ ...buffer, source: 'unique live' });
    recovery.archive({ ...buffer, source: 'unique live' });
    other.write({ ...buffer, source: 'new edits' });
    expect(recovery.others('a', 'challenge').map((row) => row.source).sort()).toEqual(['new edits', 'source', 'unique live']);
  });

  it('does not use a matching mutable tab as the sole preserved copy', () => {
    const other = createDraftRecovery(localStorage, 'other');
    other.write(buffer);
    const recovery = createDraftRecovery(localStorage, 'current');
    recovery.archive(buffer);
    other.write({ ...buffer, source: 'later edits' });
    expect(recovery.others('a', 'challenge').map((row) => row.source).sort()).toEqual(['later edits', 'source']);
  });
});
