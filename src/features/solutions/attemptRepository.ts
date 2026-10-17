import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttemptEvaluation, CreateAttemptInput, SolutionAttempt } from '../../../shared/contracts/v1';

export interface AttemptRepository {
  createAttempt(input: CreateAttemptInput): Promise<SolutionAttempt>;
  listAttempts(challengeId?: string): Promise<SolutionAttempt[]>;
  subscribeToSessionChanges(listener: () => void): () => void;
}

export type ScopedRequestClientFactory = (accessToken: string) => SupabaseClient;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Sign in to access your saved attempts.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class AttemptAuthorizationError extends Error {
  constructor() {
    super('The attempts service returned a record outside the current account.');
    this.name = 'AttemptAuthorizationError';
  }
}

export class AttemptSessionChangedError extends Error {
  constructor() {
    super('The signed-in account changed while attempts were loading. Please try again.');
    this.name = 'AttemptSessionChangedError';
  }
}

export class AttemptRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AttemptRepositoryError';
  }
}

class AttemptDataError extends Error {
  constructor() {
    super('The attempts service returned data that does not match the saved-attempt contract.');
    this.name = 'AttemptDataError';
  }
}

const savedEvaluationStatuses = new Set([
  'passed',
  'failed',
  'compile-error',
  'timeout',
  'execution-error',
  'infrastructure-error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isMissingAuthSessionError(value: unknown): boolean {
  return isRecord(value)
    && (value.name === 'AuthSessionMissingError' || value.code === 'session_not_found');
}

function decodeEvaluation(value: unknown): AttemptEvaluation {
  if (!isRecord(value)) {
    throw new AttemptDataError();
  }

  if (value.status === 'untested' && Object.keys(value).length === 1) {
    return { status: 'untested' };
  }

  if (
    typeof value.status !== 'string'
    || !savedEvaluationStatuses.has(value.status)
    || !Number.isSafeInteger(value.totalCases)
    || !Number.isSafeInteger(value.passedCases)
    || (value.totalCases as number) < 0
    || (value.passedCases as number) < 0
    || (value.passedCases as number) > (value.totalCases as number)
    || Object.keys(value).some((key) => !['status', 'totalCases', 'passedCases'].includes(key))
    || (value.status === 'passed'
      && ((value.totalCases as number) === 0 || value.totalCases !== value.passedCases))
  ) {
    throw new AttemptDataError();
  }

  return {
    status: value.status as Exclude<AttemptEvaluation['status'], 'untested'>,
    totalCases: value.totalCases as number,
    passedCases: value.passedCases as number,
  };
}

function decodeAttempt(value: unknown, expectedUserId: string): SolutionAttempt {
  if (!isRecord(value)) {
    throw new AttemptDataError();
  }

  if (!isString(value.user_id) || value.user_id !== expectedUserId) {
    throw new AttemptAuthorizationError();
  }

  const nullableString = (field: unknown): string | null => {
    if (field !== null && !isString(field)) {
      throw new AttemptDataError();
    }
    return field;
  };

  if (
    !isString(value.id)
    || !isString(value.challenge_id)
    || !isString(value.challenge_version)
    || !isString(value.source)
    || !isString(value.notes)
    || !isString(value.created_at)
  ) {
    throw new AttemptDataError();
  }

  return {
    id: value.id,
    userId: value.user_id,
    challengeId: value.challenge_id,
    challengeVersion: value.challenge_version,
    source: value.source,
    notes: value.notes,
    timeComplexity: nullableString(value.declared_time_complexity),
    spaceComplexity: nullableString(value.declared_space_complexity),
    testSummary: decodeEvaluation(value.test_summary),
    createdAt: value.created_at,
  };
}

function insertRecord(input: CreateAttemptInput) {
  return {
    challenge_id: input.challengeId,
    challenge_version: input.challengeVersion,
    source: input.source,
    notes: input.notes,
    declared_time_complexity: input.timeComplexity,
    declared_space_complexity: input.spaceComplexity,
    test_summary: input.testSummary,
  };
}

export function createAttemptRepository(
  client: SupabaseClient,
  createScopedRequestClient: ScopedRequestClientFactory,
): AttemptRepository {
  const pageSize = 1000;
  let observedUserId: string | null | undefined;
  let sessionRevision = 0;
  const sessionListeners = new Set<() => void>();

  const observeUserId = (userId: string | null): void => {
    if (observedUserId !== undefined && observedUserId !== userId) {
      sessionRevision += 1;
      for (const listener of sessionListeners) {
        listener();
      }
    }
    observedUserId = userId;
  };

  client.auth.onAuthStateChange((_event, session) => {
    observeUserId(session?.user.id ?? null);
  });

  interface VerifiedSession {
    readonly userId: string;
    readonly accessToken: string;
    readonly revision: number;
  }

  const captureVerifiedSession = async (): Promise<VerifiedSession> => {
    const revisionBeforeRead = sessionRevision;
    let result;
    try {
      result = await client.auth.getSession();
    } catch (cause) {
      throw new AttemptRepositoryError('Could not verify the signed-in account session.', { cause });
    }

    if (isMissingAuthSessionError(result.error)) {
      observeUserId(null);
      throw new AuthenticationRequiredError();
    }
    if (result.error) {
      throw new AttemptRepositoryError('Could not verify the signed-in account session.', { cause: result.error });
    }

    const session = result.data.session;
    const accessToken = session?.access_token;
    if (!session || !accessToken) {
      observeUserId(null);
      throw new AuthenticationRequiredError();
    }

    let verifiedUser;
    try {
      verifiedUser = await client.auth.getUser(accessToken);
    } catch (cause) {
      throw new AttemptRepositoryError('Could not verify the signed-in account.', { cause });
    }
    if (isMissingAuthSessionError(verifiedUser.error)) {
      observeUserId(null);
      throw new AuthenticationRequiredError();
    }
    if (verifiedUser.error) {
      throw new AttemptRepositoryError('Could not verify the signed-in account.', { cause: verifiedUser.error });
    }

    const userId = verifiedUser.data.user?.id;
    if (!userId) {
      observeUserId(null);
      throw new AuthenticationRequiredError();
    }

    if (session.user.id !== userId || sessionRevision !== revisionBeforeRead) {
      observeUserId(userId);
      throw new AttemptSessionChangedError();
    }

    observeUserId(userId);
    return { userId, accessToken, revision: sessionRevision };
  };

  const verifySameSession = async (snapshot: VerifiedSession): Promise<void> => {
    let current: VerifiedSession;
    try {
      current = await captureVerifiedSession();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError || error instanceof AttemptSessionChangedError) {
        throw new AttemptSessionChangedError();
      }
      throw error;
    }

    if (
      sessionRevision !== snapshot.revision
      || current.revision !== snapshot.revision
      || current.userId !== snapshot.userId
    ) {
      throw new AttemptSessionChangedError();
    }
  };

  const requestClientFor = (snapshot: VerifiedSession): SupabaseClient => {
    if (sessionRevision !== snapshot.revision) {
      throw new AttemptSessionChangedError();
    }
    return createScopedRequestClient(snapshot.accessToken);
  };

  return {
    async createAttempt(input) {
      const snapshot = await captureVerifiedSession();
      const { data, error } = await requestClientFor(snapshot)
        .from('solution_attempts')
        .insert(insertRecord(input))
        .select('*')
        .single();

      if (error) {
        throw new AttemptRepositoryError('Could not save this attempt.', { cause: error });
      }

      const attempt = decodeAttempt(data, snapshot.userId);
      await verifySameSession(snapshot);
      return attempt;
    },

    async listAttempts(challengeId) {
      const snapshot = await captureVerifiedSession();
      const attempts: SolutionAttempt[] = [];
      let cursor: { readonly createdAt: string; readonly id: string } | undefined;

      while (true) {
        let query = requestClientFor(snapshot)
          .from('solution_attempts')
          .select('*')
          .eq('user_id', snapshot.userId);

        if (challengeId !== undefined) {
          query = query.eq('challenge_id', challengeId);
        }
        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
          );
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, pageSize - 1);

        if (error) {
          throw new AttemptRepositoryError('Could not load saved attempts.', { cause: error });
        }
        if (!Array.isArray(data)) {
          throw new AttemptDataError();
        }

        const page = data.map((attempt) => decodeAttempt(attempt, snapshot.userId));
        attempts.push(...page);
        if (data.length < pageSize) {
          break;
        }
        const lastAttempt = page.at(-1);
        if (!lastAttempt) {
          throw new AttemptDataError();
        }
        cursor = { createdAt: lastAttempt.createdAt, id: lastAttempt.id };
      }

      await verifySameSession(snapshot);
      return attempts;
    },

    subscribeToSessionChanges(listener) {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
  };
}
