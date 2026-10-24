import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaveDraftInput, SolutionDraft } from '../../../shared/contracts/v1';
import {
  AuthenticationRequiredError,
  AttemptSessionChangedError,
  type ScopedRequestClientFactory,
} from './attemptRepository';

export type SaveDraftResult =
  { kind: 'saved'; draft: SolutionDraft } | { kind: 'conflict'; current: SolutionDraft | null };
export interface DraftRepository {
  loadDraft(challengeId: string): Promise<SolutionDraft | null>;
  saveDraft(input: SaveDraftInput): Promise<SaveDraftResult>;
}

function decodeDraft(value: unknown, owner: string, challengeId: string): SolutionDraft {
  if (!value || typeof value !== 'object') throw new Error('Invalid draft contract.');
  const row = value as Record<string, unknown>;
  if (row.user_id !== owner) throw new Error('Draft belongs to another account.');
  if (
    row.challenge_id !== challengeId ||
    typeof row.challenge_version !== 'string' ||
    !row.challenge_version ||
    typeof row.source !== 'string' ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0 ||
    typeof row.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(row.updated_at))
  ) {
    throw new Error('Invalid draft contract.');
  }
  return {
    userId: owner,
    challengeId,
    challengeVersion: row.challenge_version,
    source: row.source,
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

export function createDraftRepository(
  client: SupabaseClient,
  createScopedClient: ScopedRequestClientFactory,
): DraftRepository {
  let generation = 0;
  let observed: string | null | undefined;
  client.auth.onAuthStateChange((_event, session) => {
    const owner = session?.user.id ?? null;
    if (observed !== undefined && owner !== observed) generation += 1;
    observed = owner;
  });

  async function capture() {
    const revision = generation;
    const { data, error } = await client.auth.getSession();
    const session = data.session;
    if (error || !session || !session.access_token || (session.expires_at ?? 0) * 1000 <= Date.now()) {
      throw new AuthenticationRequiredError();
    }
    const { data: verified, error: verificationError } = await client.auth.getUser(session.access_token);
    if (verificationError || !verified.user) throw new AuthenticationRequiredError();
    if (
      revision !== generation ||
      verified.user.id !== session.user.id ||
      (observed !== undefined && observed !== verified.user.id)
    )
      throw new AttemptSessionChangedError();
    observed = verified.user.id;
    return { owner: verified.user.id, token: session.access_token, generation: revision };
  }

  async function check(snapshot: Awaited<ReturnType<typeof capture>>) {
    const current = await capture();
    if (snapshot.generation !== generation || snapshot.owner !== current.owner) throw new AttemptSessionChangedError();
  }

  async function read(scoped: SupabaseClient, owner: string, challengeId: string) {
    const { data, error } = await scoped
      .from('solution_drafts')
      .select('*')
      .eq('user_id', owner)
      .eq('challenge_id', challengeId)
      .maybeSingle();
    if (error) throw new Error('Could not load your private draft.');
    return data === null ? null : decodeDraft(data, owner, challengeId);
  }

  return {
    async loadDraft(challengeId) {
      const snapshot = await capture();
      const draft = await read(createScopedClient(snapshot.token), snapshot.owner, challengeId);
      await check(snapshot);
      return draft;
    },
    async saveDraft(input) {
      if (
        input.expectedRevision !== null &&
        (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)
      ) {
        throw new Error('Invalid expected draft revision.');
      }
      const snapshot = await capture();
      const scoped = createScopedClient(snapshot.token);
      const result =
        input.expectedRevision === null
          ? await scoped
              .from('solution_drafts')
              .insert({
                challenge_id: input.challengeId,
                challenge_version: input.challengeVersion,
                source: input.source,
              })
              .select('*')
              .single()
          : await scoped
              .from('solution_drafts')
              .update({ challenge_version: input.challengeVersion, source: input.source })
              .eq('user_id', snapshot.owner)
              .eq('challenge_id', input.challengeId)
              .eq('revision', input.expectedRevision)
              .select('*');
      await check(snapshot);
      if (result.error && !(input.expectedRevision === null && result.error.code === '23505')) {
        if (result.error.code === 'PGRST301' || result.error.code === '42501') throw new AuthenticationRequiredError();
        throw new Error('Could not save your private draft.');
      }
      if (result.error || (Array.isArray(result.data) && result.data.length === 0)) {
        const current = await read(scoped, snapshot.owner, input.challengeId);
        await check(snapshot);
        return { kind: 'conflict', current };
      }
      const data = Array.isArray(result.data) ? (result.data.length === 1 ? result.data[0] : null) : result.data;
      const draft = decodeDraft(data, snapshot.owner, input.challengeId);
      if (
        draft.source !== input.source ||
        draft.challengeVersion !== input.challengeVersion ||
        draft.revision !== (input.expectedRevision === null ? 0 : input.expectedRevision + 1)
      ) {
        throw new Error('Draft acknowledgment does not match the saved contract.');
      }
      return { kind: 'saved', draft };
    },
  };
}
