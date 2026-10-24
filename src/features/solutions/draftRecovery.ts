export interface LocalDraftBuffer {
  ownerId: string | null;
  challengeId: string;
  challengeVersion: string;
  tabId: string;
  source: string;
  expectedRevision: number | null;
  dirty: boolean;
  notes: string;
  timeComplexity: string;
  spaceComplexity: string;
  updatedAt: number;
}

const prefix = 'typescript-lab-buffer-v1:';
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
type DraftContent = Omit<LocalDraftBuffer, 'tabId' | 'updatedAt' | 'expectedRevision' | 'dirty'>;

function contentKey(buffer: DraftContent): string {
  return JSON.stringify([buffer.ownerId, buffer.challengeId, buffer.challengeVersion, buffer.source,
    buffer.notes, buffer.timeComplexity, buffer.spaceComplexity]);
}

export function sameDraftContent(left: DraftContent, right: DraftContent): boolean {
  return contentKey(left) === contentKey(right);
}

function decode(value: string | null): LocalDraftBuffer | null {
  try {
    const row = JSON.parse(value ?? 'null') as LocalDraftBuffer | null;
    if (!row || (row.ownerId !== null && typeof row.ownerId !== 'string')
      || !['challengeId', 'challengeVersion', 'tabId', 'source', 'notes', 'timeComplexity', 'spaceComplexity'].every((key) => typeof row[key as keyof LocalDraftBuffer] === 'string')
      || typeof row.dirty !== 'boolean' || !Number.isFinite(row.updatedAt)
      || (row.expectedRevision !== null && (!Number.isSafeInteger(row.expectedRevision) || row.expectedRevision < 0))) return null;
    return row;
  } catch { return null; }
}

export function createDraftRecovery(storage: RecoveryStorage, tabId: string,
  previousTab?: string | ((owner: string | null, challenge: string) => string | undefined),
  remember?: (owner: string | null, challenge: string, tab: string) => void) {
  const keyFor = (owner: string | null, challenge: string, tab = tabId) => prefix + JSON.stringify([owner, challenge, tab]);
  function stored(owner: string | null, challenge: string): LocalDraftBuffer[] {
    const rows: LocalDraftBuffer[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const row = decode(storage.getItem(key));
      if (row && row.ownerId === owner && row.challengeId === challenge
        && key === keyFor(owner, challenge, row.tabId)) rows.push(row);
    }
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return {
    tabId,
    read(owner: string | null, challenge: string, tab?: string): LocalDraftBuffer | null {
      const requestedTab = tab ?? tabId;
      const row = decode(storage.getItem(keyFor(owner, challenge, requestedTab)));
      if (row?.ownerId === owner && row.challengeId === challenge && row.tabId === requestedTab) return row;
      const previousTabId = typeof previousTab === 'function' ? previousTab(owner, challenge) : previousTab;
      if (tab === undefined && previousTabId) {
        const previous = decode(storage.getItem(keyFor(owner, challenge, previousTabId)));
        if (previous?.ownerId === owner && previous.challengeId === challenge && previous.tabId === previousTabId) {
          return { ...previous, tabId };
        }
      }
      return null;
    },
    write(buffer: Omit<LocalDraftBuffer, 'tabId' | 'updatedAt'>) {
      storage.setItem(keyFor(buffer.ownerId, buffer.challengeId), JSON.stringify({ ...buffer, tabId, updatedAt: Date.now() }));
      remember?.(buffer.ownerId, buffer.challengeId, tabId);
    },
    archive(buffer: Omit<LocalDraftBuffer, 'tabId' | 'updatedAt'>) {
      // Live tabs may overwrite their buffers later; only immutable archives can replace this snapshot.
      if (stored(buffer.ownerId, buffer.challengeId).some((row) => row.tabId.startsWith('archive-')
        && sameDraftContent(row, buffer))) return;
      const archiveId = `archive-${crypto.randomUUID()}`;
      storage.setItem(keyFor(buffer.ownerId, buffer.challengeId, archiveId), JSON.stringify({ ...buffer, tabId: archiveId, updatedAt: Date.now() }));
    },
    others(owner: string | null, challenge: string): LocalDraftBuffer[] {
      const seen = new Set<string>();
      return stored(owner, challenge).filter((row) => {
        if (row.tabId === tabId || (!row.dirty && !row.notes && !row.timeComplexity && !row.spaceComplexity)) return false;
        const key = contentKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  };
}
export type DraftRecovery = ReturnType<typeof createDraftRecovery>;

let pageIdentity: { id: string; previous: string | undefined } | undefined;
export function recoveryTabId(): string {
  if (pageIdentity) return pageIdentity.id;
  const id = crypto.randomUUID();
  try {
    const key = 'typescript-lab-editor-tab-v1';
    const previous = sessionStorage.getItem(key) ?? undefined;
    sessionStorage.setItem(key, id);
    pageIdentity = { id, previous };
  } catch {
    pageIdentity = { id, previous: undefined };
  }
  return id;
}
export function previousRecoveryTabId(): string | undefined { recoveryTabId(); return pageIdentity?.previous; }
