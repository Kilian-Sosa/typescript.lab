import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveDraftInput, SolutionDraft } from '../../../shared/contracts/v1';
import type { DraftRepository, SaveDraftResult } from './draftRepository';
import { createDraftRecovery } from './draftRecovery';
import { createDraftSync } from './draftSync';

const challenge = { id: 'longest-window', version: '1.0.0', starter: 'starter' };
const draft = (source: string, revision = 0, userId = 'a'): SolutionDraft => ({
  userId, source, revision, challengeId: challenge.id, challengeVersion: challenge.version, updatedAt: '2026-10-17T00:00:00Z',
});
function server(initial: SolutionDraft | null = null) {
  let current = initial;
  const writes: SaveDraftInput[] = [];
  let offline = false;
  const repository: DraftRepository = {
    async loadDraft() { if (offline) throw new Error('offline'); return current; },
    async saveDraft(input) {
      writes.push(input);
      if (offline) throw new Error('offline');
      if ((current?.revision ?? null) !== input.expectedRevision) return { kind: 'conflict', current };
      current = draft(input.source, current ? current.revision + 1 : 0);
      return { kind: 'saved', draft: current };
    },
  };
  return { repository, writes, offline(value: boolean) { offline = value; }, current: () => current };
}
function controller(repository: DraftRepository, tab = 'tab-one', fresh = false) {
  return createDraftSync({ repository, recovery: createDraftRecovery(localStorage, tab), challenge, fresh, isOnline: () => navigator.onLine });
}
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('resilient draft synchronization', () => {
  it('copies reload recovery into a new page buffer without sharing writes with a duplicated tab', () => {
    const old = createDraftRecovery(localStorage, 'old-page');
    old.write({ ownerId: 'a', challengeId: challenge.id, challengeVersion: challenge.version, source: 'before duplicate',
      expectedRevision: 0, dirty: true, notes: '', timeComplexity: '', spaceComplexity: '' });
    const duplicate = createDraftRecovery(localStorage, 'new-page', 'old-page');
    const recovered = duplicate.read('a', challenge.id)!;
    expect(recovered.source).toBe('before duplicate');
    duplicate.write({ ...recovered, source: 'duplicate edits' });
    expect(old.read('a', challenge.id)?.source).toBe('before duplicate');
    expect(duplicate.read('a', challenge.id)?.source).toBe('duplicate edits');
  });
  it('debounces edits and labels only the acknowledged source saved', async () => {
    const backend = server();
    const sync = controller(backend.repository);
    await sync.connect('a');
    sync.edit('first');
    sync.edit('latest');
    expect(backend.writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(600);
    expect(backend.writes).toHaveLength(1);
    expect(backend.current()?.source).toBe('latest');
    expect(sync.state.status).toBe('saved');
    sync.dispose();
  });

  it('serializes saves and keeps newer edits unsaved while an older response is pending', async () => {
    const backend = server();
    let release!: (result: SaveDraftResult) => void;
    const repository = { ...backend.repository, saveDraft: vi.fn(() => new Promise<SaveDraftResult>((resolve) => { release = resolve; })) };
    const sync = controller(repository);
    await sync.connect('a');
    sync.edit('older');
    const saving = sync.flush();
    sync.edit('newer');
    await vi.advanceTimersByTimeAsync(700);
    expect(repository.saveDraft).toHaveBeenCalledTimes(1);
    release({ kind: 'saved', draft: draft('older') });
    await saving;
    expect(sync.state.source).toBe('newer');
    expect(sync.state.status).not.toBe('saved');
    expect(sync.state.revision).toBe(0);
    sync.dispose();
  });

  it('detects two-tab conflicts and requires review before keeping local text', async () => {
    const backend = server(draft('cloud'));
    const one = controller(backend.repository);
    const two = controller(backend.repository, 'tab-two');
    await Promise.all([one.connect('a'), two.connect('a')]);
    one.edit('one'); await one.flush();
    two.edit('two'); await two.flush();
    expect(two.state.status).toBe('conflict');
    expect(two.state.source).toBe('two');
    expect(two.state.remoteDraft?.source).toBe('one');
    await vi.advanceTimersByTimeAsync(2000);
    expect(backend.current()?.source).toBe('one');
    await two.resolveConflict('local');
    expect(backend.current()?.source).toBe('two');
    one.dispose(); two.dispose();
  });

  it('recovers an interrupted offline save with its original revision after reload', async () => {
    const backend = server(draft('cloud'));
    const first = controller(backend.repository);
    await first.connect('a');
    backend.offline(true);
    first.edit('offline work');
    first.editNotes({ notes: 'local reasoning', timeComplexity: 'O(n)', spaceComplexity: '' });
    await first.flush();
    expect(first.state.status).not.toBe('saved');
    first.dispose();
    const reload = controller(backend.repository);
    await reload.connect('a');
    expect(reload.state.source).toBe('offline work');
    expect(reload.state.notes).toBe('local reasoning');
    backend.offline(false);
    await reload.retry();
    expect(backend.current()?.source).toBe('offline work');
    expect(reload.state.status).toBe('saved');
    reload.dispose();
  });

  it('retains the buffer when the server committed but the acknowledgment was lost', async () => {
    const backend = server(draft('cloud'));
    let failAck = true;
    const repository = { ...backend.repository, async saveDraft(input: SaveDraftInput) {
      const result = await backend.repository.saveDraft(input);
      if (failAck) { failAck = false; throw new Error('connection lost'); }
      return result;
    } };
    const sync = controller(repository);
    await sync.connect('a'); sync.edit('uncertain'); await sync.flush();
    expect(sync.state.status).not.toBe('saved');
    await sync.retry();
    expect(sync.state.status).toBe('saved');
    expect(backend.current()?.source).toBe('uncertain');
    sync.dispose();
  });

  it('clears private source and notes on account change without importing them into the guest or another account', async () => {
    const backend = server();
    const sync = controller(backend.repository);
    await sync.connect('a'); sync.edit('A private'); sync.editNotes({ notes: 'A notes', timeComplexity: '', spaceComplexity: '' });
    const signout = sync.connect(null);
    expect(sync.state.source).toBe('starter');
    expect(sync.state.notes).toBe('');
    await signout;
    await sync.connect('b');
    expect(sync.state.source).toBe('starter');
    expect(sync.state.guestAvailable).toBe(false);
    await sync.connect('a');
    expect(sync.state.source).toBe('A private');
    expect(sync.state.notes).toBe('A notes');
    sync.dispose();
  });

  it('never applies a stale load or save to another account', async () => {
    let release!: (draft: SolutionDraft | null) => void;
    const backend = server();
    const repository = { ...backend.repository, loadDraft: vi.fn()
      .mockImplementationOnce(() => new Promise<SolutionDraft | null>((resolve) => { release = resolve; }))
      .mockResolvedValue(null) };
    const sync = controller(repository);
    const loading = sync.connect('a');
    await sync.connect('b'); release(draft('private A')); await loading;
    expect(sync.state.source).toBe('starter');
    sync.dispose();
  });

  it('ignores a save acknowledgment after switching accounts, even when the old account returns later', async () => {
    let release!: (result: SaveDraftResult) => void;
    const backend = server();
    const sync = controller({ ...backend.repository, saveDraft: () => new Promise((resolve) => { release = resolve; }) });
    await sync.connect('a'); sync.edit('A old response');
    const saving = sync.flush();
    await sync.connect('b'); sync.edit('B current');
    release({ kind: 'saved', draft: draft('A old response') }); await saving;
    expect(sync.state.source).toBe('B current');
    expect(sync.state.status).not.toBe('saved');
    sync.dispose();
  });

  it('does not replace typing that began while the cloud draft was loading', async () => {
    let release!: (draft: SolutionDraft) => void;
    const backend = server();
    const sync = controller({ ...backend.repository, loadDraft: () => new Promise((resolve) => { release = resolve; }) });
    const loading = sync.connect('a'); sync.edit('typing'); release(draft('cloud')); await loading;
    expect(sync.state.source).toBe('typing');
    expect(sync.state.status).toBe('conflict');
    sync.dispose();
  });

  it('offers guest import explicitly and CAS protects an existing cloud draft', async () => {
    const backend = server(draft('cloud'));
    const sync = controller(backend.repository);
    await sync.connect(null); sync.edit('guest work');
    await sync.connect('a');
    expect(sync.state.source).toBe('cloud');
    expect(sync.state.guestAvailable).toBe(true);
    expect(backend.writes).toHaveLength(0);
    await sync.importGuest();
    expect(backend.current()?.source).toBe('guest work');
    expect(backend.writes[0]?.expectedRevision).toBe(0);
    sync.dispose();
  });

  it('keeps Retry from scratch free of previous source while retaining recovery elsewhere', async () => {
    const backend = server(draft('old solution'));
    const sync = controller(backend.repository, 'fresh-attempt', true);
    await sync.connect('a');
    expect(sync.state.source).toBe('starter');
    expect(backend.writes).toHaveLength(0);
    sync.dispose();
  });

  it('keeps two local tab buffers separate and offers recovery from a closed tab', async () => {
    const backend = server();
    const one = controller(backend.repository); const two = controller(backend.repository, 'tab-two');
    await one.connect('a'); await two.connect('a');
    one.edit('tab one'); two.edit('tab two'); one.dispose(); two.dispose();
    const reopened = controller(backend.repository, 'new-tab');
    await reopened.connect('a');
    expect(reopened.state.otherRecoveries).toHaveLength(2);
    await reopened.recoverBuffer(reopened.state.otherRecoveries[0]!.tabId);
    expect(['tab one', 'tab two']).toContain(reopened.state.source);
    reopened.dispose();
  });

  it('preserves the current local buffer before an explicit recovery or guest import replaces it', async () => {
    const backend = server();
    const one = controller(backend.repository); const other = controller(backend.repository, 'other-tab');
    await one.connect(null); one.edit('original guest');
    await other.connect(null); other.edit('other guest'); other.dispose();
    await one.recoverBuffer('other-tab');
    expect(one.state.source).toBe('other guest');
    expect(one.state.status).toBe('guest');
    const archived = createDraftRecovery(localStorage, 'observer').others(null, challenge.id);
    expect(archived.some((row) => row.source === 'original guest')).toBe(true);
    one.dispose();
  });

  it('reports unavailable local storage honestly while retaining current editor text', async () => {
    const backend = server();
    const sync = createDraftSync({ repository: backend.repository, challenge,
      recovery: createDraftRecovery({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {}, key: () => null, length: 0 }, 'tab'), isOnline: () => true });
    await sync.connect(null); sync.edit('still here');
    expect(sync.state.source).toBe('still here');
    expect(sync.state.localError).toBe(true);
    sync.dispose();
  });

  it('retains in-memory private work on retry and account changes when recovery storage fails', async () => {
    const backend = server();
    const sync = createDraftSync({ repository: backend.repository, challenge,
      recovery: createDraftRecovery({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {}, key: () => null, length: 0 }, 'tab'), isOnline: () => true });
    await sync.connect('a'); sync.edit('memory-only source');
    sync.editNotes({ notes: 'memory-only notes', timeComplexity: '', spaceComplexity: '' });
    await sync.connect(null);
    expect(sync.state.localError).toBe(true);
    await sync.connect('a');
    expect(sync.state.source).toBe('memory-only source');
    expect(sync.state.notes).toBe('memory-only notes');
    await sync.retry();
    expect(backend.current()?.source).toBe('memory-only source');
    expect(sync.state.localError).toBe(true);
    sync.dispose();
  });
});
