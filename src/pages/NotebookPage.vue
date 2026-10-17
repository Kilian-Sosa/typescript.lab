<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { SolutionAttempt } from '../../shared/contracts/v1';
import { findChallenge } from '../features/challenges/registry';
import {
  AuthenticationRequiredError,
  type AttemptRepository,
} from '../features/solutions/attemptRepository';
import { exportAttemptsJson } from '../features/solutions/exportAttempts';
import { attemptRepositoryKey, notebookSessionKey } from '../features/solutions/session';

type PageState = 'unconfigured' | 'loading' | 'ready' | 'empty' | 'signed-out' | 'error';
interface ChallengeGroup {
  readonly challengeId: string;
  readonly title: string;
  readonly attempts: readonly SolutionAttempt[];
  readonly latest: SolutionAttempt;
}

const repository = inject<AttemptRepository | null>(attemptRepositoryKey, null);
const session = inject(notebookSessionKey, null);
const state = ref<PageState>('loading');
const attempts = ref<SolutionAttempt[]>([]);
let unsubscribeSession: (() => void) | undefined;
let loadRevision = 0;

const challengeGroups = computed<ChallengeGroup[]>(() => {
  const groups = new Map<string, SolutionAttempt[]>();
  for (const attempt of attempts.value) {
    const group = groups.get(attempt.challengeId) ?? [];
    group.push(attempt);
    groups.set(attempt.challengeId, group);
  }

  return Array.from(groups, ([challengeId, groupedAttempts]) => ({
    challengeId,
    title: findChallenge(challengeId)?.title ?? challengeId,
    attempts: groupedAttempts,
    latest: groupedAttempts[0]!,
  }));
});

function attemptStatus(attempt: SolutionAttempt): string {
  if (attempt.testSummary.status === 'untested') {
    return 'Untested';
  }
  const { status, passedCases, totalCases } = attempt.testSummary;
  return `${status} · ${passedCases}/${totalCases} cases`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function loadAttempts(): Promise<void> {
  const currentRevision = ++loadRevision;
  attempts.value = [];
  if (!repository) {
    state.value = 'unconfigured';
    return;
  }

  state.value = 'loading';
  try {
    const loadedAttempts = await repository.listAttempts();
    if (currentRevision !== loadRevision) {
      return;
    }
    attempts.value = loadedAttempts;
    state.value = loadedAttempts.length > 0 ? 'ready' : 'empty';
  } catch (error) {
    if (currentRevision !== loadRevision) {
      return;
    }
    attempts.value = [];
    state.value = error instanceof AuthenticationRequiredError ? 'signed-out' : 'error';
  }
}

function clearAndReload(): void {
  attempts.value = [];
  void loadAttempts();
}

async function signIn(): Promise<void> {
  if (!session) {
    return;
  }
  try {
    await session.signInWithGitHub('/notebook');
  } catch {
    state.value = 'error';
  }
}

function downloadAllAttempts(): void {
  if (attempts.value.length === 0) {
    return;
  }
  const blob = new Blob([exportAttemptsJson(attempts.value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'typescript-lab-notebook.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  if (repository) {
    unsubscribeSession = repository.subscribeToSessionChanges(clearAndReload);
  }
  void loadAttempts();
});

onBeforeUnmount(() => {
  loadRevision += 1;
  unsubscribeSession?.();
});
</script>

<template>
  <section class="page-section notebook-page" aria-labelledby="notebook-title">
    <header class="notebook-heading">
      <div>
        <p class="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p>
        <h1 id="notebook-title">My Notebook<span class="accent-period">.</span></h1>
        <p class="page-intro">A private home for your saved approaches and learning notes.</p>
      </div>
      <button
        v-if="state === 'ready'"
        class="secondary-button"
        type="button"
        aria-label="Export all attempts as JSON"
        @click="downloadAllAttempts"
      >
        Export all attempts as JSON
      </button>
    </header>

    <p v-if="state === 'loading'" class="notice-panel" role="status">Loading your private attempts…</p>

    <section v-else-if="state === 'unconfigured' || state === 'signed-out'" class="notice-panel guest-gate" aria-labelledby="guest-gate-title">
      <span class="gate-icon" aria-hidden="true">▤</span>
      <div>
        <h2 id="guest-gate-title">Sign in to open your notebook</h2>
        <p>Your saved attempts and notes remain private to your account.</p>
        <p v-if="state === 'unconfigured'">
          Private notebook access needs the public Supabase URL and publishable key in this environment.
          No example history is shown.
        </p>
        <p v-else>Sign in to load your saved attempts. No history is available while signed out.</p>
        <button
          v-if="state === 'signed-out' && session"
          class="primary-button sign-in-button"
          type="button"
          aria-label="Sign in with GitHub"
          @click="signIn"
        >
          Sign in with GitHub
        </button>
      </div>
    </section>

    <section v-else-if="state === 'error'" class="notice-panel notice-error" role="alert">
      <h2>Could not load your notebook</h2>
      <p>Your saved data is not shown because the private history could not be verified.</p>
      <button class="secondary-button" type="button" @click="loadAttempts">Try again</button>
    </section>

    <section v-else-if="state === 'empty'" class="empty-state" aria-labelledby="empty-notebook-title">
      <span class="empty-state-mark" aria-hidden="true">01</span>
      <h2 id="empty-notebook-title">Your notebook is empty</h2>
      <p>Save an attempt from a challenge to keep your original source and learning notes here.</p>
      <RouterLink class="primary-button" to="/explore">Explore challenges</RouterLink>
    </section>

    <section v-else class="notebook-list" aria-label="Saved challenge attempts">
      <article v-for="group in challengeGroups" :key="group.challengeId" class="notebook-challenge-card">
        <div class="notebook-card-copy">
          <RouterLink
            class="notebook-challenge-link"
            :to="{ name: 'notebook-detail', params: { slug: group.challengeId } }"
          >
            {{ group.title }}
          </RouterLink>
          <p class="notebook-card-meta">
            {{ group.attempts.length }} {{ group.attempts.length === 1 ? 'attempt' : 'attempts' }}
            <span aria-hidden="true">·</span>
            Latest {{ formatDate(group.latest.createdAt) }}
          </p>
          <p class="notebook-card-note">{{ group.latest.notes || 'No learning notes saved yet.' }}</p>
        </div>
        <span class="attempt-status-label">{{ attemptStatus(group.latest) }}</span>
      </article>
    </section>
  </section>
</template>

<style scoped>
.notebook-page {
  display: grid;
  gap: 22px;
}

.notebook-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
}

.notebook-heading h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 730;
  letter-spacing: -0.055em;
  line-height: 1.15;
}

.notebook-heading .eyebrow {
  margin-bottom: 10px;
}

.notebook-heading .page-intro {
  margin-top: 11px;
}

.notebook-list {
  display: grid;
  gap: 12px;
}

.notebook-challenge-card {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
  padding: 19px 21px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.notebook-card-copy {
  min-width: 0;
}

.notebook-challenge-link {
  color: var(--text);
  font-size: 17px;
  font-weight: 700;
  text-decoration: none;
}

.notebook-challenge-link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.notebook-card-meta,
.notebook-card-note {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.notebook-card-note {
  max-width: 700px;
}

.attempt-status-label {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
}

.guest-gate {
  display: flex;
  align-items: start;
  gap: 14px;
  margin-top: 0;
}

.guest-gate h2,
.notice-error h2 {
  margin: 0;
  font-size: 17px;
}

.gate-icon {
  color: var(--accent-strong);
  font-size: 21px;
}

.sign-in-button {
  margin-top: 14px;
}

.empty-state .primary-button {
  margin-top: 14px;
  text-decoration: none;
}

.notice-error .secondary-button {
  margin-top: 12px;
}

@media (max-width: 620px) {
  .notebook-heading {
    align-items: start;
    flex-direction: column;
  }

  .notebook-challenge-card {
    flex-direction: column;
  }
}
</style>
