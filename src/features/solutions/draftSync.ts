import { reactive, readonly } from 'vue';
import type { SolutionDraft } from '../../../shared/contracts/v1';
import { AuthenticationRequiredError, AttemptSessionChangedError } from './attemptRepository';
import type { DraftRepository } from './draftRepository';
import type { DraftRecovery, LocalDraftBuffer } from './draftRecovery';

export type DraftSaveState = 'loading' | 'idle' | 'guest' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict' | 'auth-required';
interface DraftState {
  source: string;
  notes: string;
  timeComplexity: string;
  spaceComplexity: string;
  status: DraftSaveState;
  ownerId: string | null;
  revision: number | null;
  remoteDraft: SolutionDraft | null;
  guestAvailable: boolean;
  otherRecoveries: { tabId: string; updatedAt: number }[];
  localError: boolean;
}

export function createDraftSync(options: {
  repository: DraftRepository | null;
  recovery: DraftRecovery;
  challenge: { id: string; version: string; starter: string };
  fresh?: boolean;
  isOnline: () => boolean;
}) {
  const { challenge, recovery, repository } = options;
  const state = reactive<DraftState>({ source: challenge.starter, notes: '', timeComplexity: '', spaceComplexity: '',
    status: 'idle', ownerId: null, revision: null, remoteDraft: null, guestAvailable: false, otherRecoveries: [], localError: false });
  let generation = 0;
  let disposed = false;
  let connected = false;
  let dirty = false;
  let loaded = false;
  let flight: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const memoryBuffers = new Map<string | null, LocalDraftBuffer>();
  const storageFailures = new Set<string | null>();

  function read(owner: string | null, tab?: string): LocalDraftBuffer | null {
    if (tab === undefined && memoryBuffers.has(owner)) return memoryBuffers.get(owner)!;
    try { return recovery.read(owner, challenge.id, tab); } catch { storageFailures.add(owner); state.localError = true; return null; }
  }

  function persist() {
    if (!connected) return;
    const buffer = { ownerId: state.ownerId, challengeId: challenge.id, challengeVersion: challenge.version,
      source: state.source, expectedRevision: state.revision, dirty, notes: state.notes,
      timeComplexity: state.timeComplexity, spaceComplexity: state.spaceComplexity };
    memoryBuffers.set(state.ownerId, { ...buffer, tabId: recovery.tabId, updatedAt: Date.now() });
    try {
      recovery.write(buffer);
      storageFailures.delete(state.ownerId);
      state.localError = storageFailures.size > 0;
    } catch { storageFailures.add(state.ownerId); state.localError = true; }
  }

  function restore(buffer: LocalDraftBuffer) {
    state.source = buffer.source;
    state.notes = buffer.notes;
    state.timeComplexity = buffer.timeComplexity;
    state.spaceComplexity = buffer.spaceComplexity;
    state.revision = buffer.expectedRevision;
    dirty = buffer.dirty;
  }

  function preserveBeforeReplace(): boolean {
    if (!dirty && !state.notes && !state.timeComplexity && !state.spaceComplexity) return true;
    try {
      recovery.archive({ ownerId: state.ownerId, challengeId: challenge.id, challengeVersion: challenge.version,
        source: state.source, expectedRevision: state.revision, dirty, notes: state.notes,
        timeComplexity: state.timeComplexity, spaceComplexity: state.spaceComplexity });
      state.otherRecoveries = recovery.others(state.ownerId, challenge.id).map(({ tabId, updatedAt }) => ({ tabId, updatedAt }));
      return true;
    } catch { state.localError = true; return false; }
  }

  function schedule() {
    clearTimeout(timer);
    if (!disposed && dirty && loaded && state.ownerId && state.status !== 'conflict' && state.status !== 'auth-required') {
      timer = setTimeout(() => { void flush(); }, 500);
    }
  }

  function failure(error: unknown) {
    state.status = error instanceof AuthenticationRequiredError || error instanceof AttemptSessionChangedError
      ? 'auth-required' : options.isOnline() ? 'error' : 'offline';
  }

  async function connect(ownerId: string | null): Promise<void> {
    if (disposed) return;
    const epoch = ++generation;
    clearTimeout(timer);
    flight = null;
    loaded = false;
    connected = true;
    dirty = false;
    Object.assign(state, { ownerId, source: challenge.starter, notes: '', timeComplexity: '', spaceComplexity: '',
      revision: null, remoteDraft: null, status: ownerId ? 'loading' : 'guest', localError: storageFailures.size > 0, guestAvailable: false, otherRecoveries: [] });
    const local = read(ownerId);
    if (local) restore(local);
    try { state.otherRecoveries = recovery.others(ownerId, challenge.id).map(({ tabId, updatedAt }) => ({ tabId, updatedAt })); }
    catch { state.localError = true; }
    if (!ownerId) { loaded = true; return; }
    const guest = read(null);
    state.guestAvailable = !!guest && (guest.source !== challenge.starter || guest.notes !== '');
    if (!repository) { state.status = 'error'; return; }
    try {
      const cloud = await repository.loadDraft(challenge.id);
      if (disposed || epoch !== generation) return;
      if (cloud && cloud.userId !== ownerId) throw new AttemptSessionChangedError();
      loaded = true;
      state.remoteDraft = cloud;
      if ((local?.challengeVersion && local.challengeVersion !== challenge.version)
        || (cloud && cloud.challengeVersion !== challenge.version)) {
        state.status = 'conflict';
        return;
      }
      if (dirty) {
        if (cloud?.source === state.source && cloud.challengeVersion === challenge.version) {
          state.revision = cloud.revision;
          dirty = false;
          state.status = 'saved';
          persist();
        } else if ((cloud?.revision ?? null) !== state.revision) state.status = 'conflict';
        else { state.status = 'idle'; schedule(); }
      } else {
        if (!options.fresh && cloud) state.source = cloud.source;
        state.revision = cloud?.revision ?? null;
        state.status = cloud && state.source === cloud.source ? 'saved' : 'idle';
      }
    } catch (error) {
      if (!disposed && epoch === generation) failure(error);
    }
  }

  function edit(source: string) {
    if (disposed || source === state.source) return;
    state.source = source;
    dirty = true;
    persist();
    if (!state.ownerId) state.status = 'guest';
    else if (state.status !== 'conflict' && state.status !== 'auth-required' && state.status !== 'loading') state.status = options.isOnline() ? 'idle' : 'offline';
    schedule();
  }

  function editNotes(notes: { notes: string; timeComplexity: string; spaceComplexity: string }) {
    Object.assign(state, notes);
    persist();
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (disposed || !dirty || !loaded || !state.ownerId || !repository || flight === generation
      || state.status === 'conflict' || state.status === 'auth-required') return;
    if (!options.isOnline()) { state.status = 'offline'; persist(); return; }
    const epoch = generation;
    const owner = state.ownerId;
    const source = state.source;
    flight = epoch;
    state.status = 'saving';
    try {
      const result = await repository.saveDraft({ challengeId: challenge.id, challengeVersion: challenge.version,
        source, expectedRevision: state.revision });
      if (disposed || epoch !== generation || owner !== state.ownerId) return;
      if (result.kind === 'conflict') {
        state.remoteDraft = result.current;
        if (result.current?.source === state.source && result.current.challengeVersion === challenge.version && result.current.userId === owner) {
          state.revision = result.current.revision;
          dirty = false;
          state.status = 'saved';
        } else state.status = 'conflict';
      } else {
        if (result.draft.userId !== owner || result.draft.source !== source) throw new AttemptSessionChangedError();
        state.revision = result.draft.revision;
        state.remoteDraft = result.draft;
        dirty = state.source !== source;
        state.status = dirty ? 'idle' : 'saved';
      }
      persist();
    } catch (error) {
      if (!disposed && epoch === generation) { failure(error); persist(); }
    } finally {
      if (flight === epoch) flight = null;
      if (!disposed && epoch === generation && state.status === 'idle') schedule();
    }
  }

  async function retry() { await connect(state.ownerId); if (dirty && state.status !== 'conflict') await flush(); }

  async function resolveConflict(choice: 'local' | 'remote') {
    if (state.status !== 'conflict') return;
    if (choice === 'remote') {
      if (!preserveBeforeReplace()) return;
      state.source = state.remoteDraft?.source ?? challenge.starter;
      dirty = false;
      state.status = state.remoteDraft ? 'saved' : 'idle';
    } else { dirty = true; state.status = 'idle'; }
    state.revision = state.remoteDraft?.revision ?? null;
    persist();
    if (choice === 'local') await flush();
  }

  async function importGuest() {
    if (!state.ownerId || !loaded || state.status === 'conflict') return;
    const guest = read(null);
    if (!guest) return;
    if (!preserveBeforeReplace()) return;
    state.source = guest.source;
    state.notes = guest.notes;
    state.timeComplexity = guest.timeComplexity;
    state.spaceComplexity = guest.spaceComplexity;
    dirty = true;
    state.status = 'idle';
    persist();
    await flush();
  }

  async function recoverBuffer(tabId: string) {
    const buffer = read(state.ownerId, tabId);
    if (!buffer) return;
    if (!preserveBeforeReplace()) return;
    restore(buffer);
    dirty = true;
    state.status = state.ownerId ? 'conflict' : 'guest';
    persist();
  }

  return {
    state: readonly(state), connect, edit, editNotes, flush, retry, resolveConflict, importGuest, recoverBuffer,
    guestBuffer: () => read(null),
    setOffline() { clearTimeout(timer); if (state.ownerId && dirty) state.status = 'offline'; persist(); },
    dispose() { persist(); disposed = true; generation += 1; clearTimeout(timer); },
  };
}
export type DraftSync = ReturnType<typeof createDraftSync>;
