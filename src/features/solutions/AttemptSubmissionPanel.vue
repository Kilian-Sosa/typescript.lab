<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import type { SolutionAttempt } from '../../../shared/contracts/v1';
import { authControllerKey } from '../auth/auth';
import {
  AttemptSessionChangedError,
  AuthenticationRequiredError,
  AttemptAuthorizationError,
} from './attemptRepository';
import { attemptRepositoryKey, notebookSessionKey } from './session';

const props = defineProps<{
  challengeId: string;
  challengeVersion: string;
  source: string;
  recoveryNotes?: { notes: string; timeComplexity: string; spaceComplexity: string };
  returnTo?: string;
}>();

const emit = defineEmits<{
  saved: [attempt: SolutionAttempt];
  notesChanged: [notes: { notes: string; timeComplexity: string; spaceComplexity: string }];
}>();

const repository = inject(attemptRepositoryKey, null);
const auth = inject(authControllerKey, null);
const session = inject(notebookSessionKey, null);
const notes = ref('');
const timeComplexity = ref('');
const spaceComplexity = ref('');
const isSaving = ref(false);
const statusMessage = ref('');
const errorMessage = ref('');
const needsSignIn = ref(false);
watch(() => props.recoveryNotes, (value) => {
  if (!value) return;
  notes.value = value.notes;
  timeComplexity.value = value.timeComplexity;
  spaceComplexity.value = value.spaceComplexity;
}, { immediate: true, deep: true });
watch([notes, timeComplexity, spaceComplexity], () => {
  emit('notesChanged', { notes: notes.value, timeComplexity: timeComplexity.value, spaceComplexity: spaceComplexity.value });
}, { flush: 'sync' });

async function saveAttempt(): Promise<void> {
  if (!repository) {
    errorMessage.value = 'Private saving is unavailable until Supabase is configured.';
    return;
  }

  isSaving.value = true;
  statusMessage.value = '';
  errorMessage.value = '';
  needsSignIn.value = false;

  try {
    const userId = auth?.state.userId;
    if (!userId || auth?.state.status !== 'signed-in' || auth.state.signingOut || auth.state.signOutFailed) {
      throw new AuthenticationRequiredError();
    }
    const attempt = await repository.createAttempt({
      challengeId: props.challengeId,
      challengeVersion: props.challengeVersion,
      source: props.source,
      notes: notes.value,
      timeComplexity: timeComplexity.value.trim() || null,
      spaceComplexity: spaceComplexity.value.trim() || null,
      testSummary: { status: 'untested' },
    }, userId);
    statusMessage.value = 'Attempt saved. Test status: Untested.';
    emit('saved', attempt);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      errorMessage.value = 'Sign in to save this private attempt.';
      needsSignIn.value = true;
    } else if (error instanceof AttemptSessionChangedError || error instanceof AttemptAuthorizationError) {
      errorMessage.value = 'Your account changed before this attempt was saved. Sign in again and retry.';
      needsSignIn.value = true;
    } else {
      errorMessage.value = 'This attempt could not be saved. Your source and notes are still here; try again.';
    }
  } finally {
    isSaving.value = false;
  }
}

async function signIn(): Promise<void> {
  if (!session) {
    return;
  }

  try {
    await session.signInWithGitHub(props.returnTo ?? '/notebook');
  } catch {
    errorMessage.value = 'GitHub sign-in could not start. Check the configured provider and retry.';
  }
}
</script>

<template>
  <section class="submission-panel" aria-labelledby="submission-title">
    <div class="submission-heading">
      <div>
        <p class="eyebrow">PERSONAL NOTEBOOK</p>
        <h2 id="submission-title">Save this attempt</h2>
      </div>
      <span class="untested-label">Evaluation: untested</span>
    </div>

    <form class="submission-form" :aria-busy="isSaving" @submit.prevent="saveAttempt">
      <label for="attempt-notes">Learning notes</label>
      <textarea
        id="attempt-notes"
        v-model="notes"
        aria-label="Learning notes"
        rows="4"
        placeholder="What did you notice? What would you try next time?"
      />

      <fieldset class="complexity-fields">
        <legend>Declared complexity (optional)</legend>
        <label>
          Time complexity
          <input
            v-model="timeComplexity"
            type="text"
            aria-label="Declared time complexity"
            placeholder="O(n)"
          />
        </label>
        <label>
          Space complexity
          <input
            v-model="spaceComplexity"
            type="text"
            aria-label="Declared space complexity"
            placeholder="O(k)"
          />
        </label>
      </fieldset>

      <p class="submission-explanation">
        Saving keeps an immutable copy of the current editor source, these notes, and challenge version
        {{ challengeVersion }}. Tests have not been run by this save action.
      </p>
      <button class="primary-button save-button" type="submit" aria-label="Save attempt" :disabled="isSaving">
        {{ isSaving ? 'Saving…' : 'Save attempt' }}
      </button>
      <p v-if="statusMessage" class="submission-status" role="status">{{ statusMessage }}</p>
      <div v-if="errorMessage" class="submission-error" role="alert">
        <p>{{ errorMessage }}</p>
        <button
          v-if="needsSignIn && session"
          class="text-button"
          type="button"
          aria-label="Sign in with GitHub"
          @click="signIn"
        >
          Sign in with GitHub
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.submission-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.submission-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.submission-heading .eyebrow {
  margin-bottom: 5px;
}

.submission-heading h2 {
  margin: 0;
  font-size: 19px;
}

.untested-label {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.submission-form {
  display: grid;
  gap: 9px;
}

.submission-form > label,
.complexity-fields label {
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
}

.submission-form textarea,
.complexity-fields input {
  width: 100%;
  min-width: 0;
  margin-top: 5px;
  padding: 10px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--text);
  background: var(--surface-soft);
  font: inherit;
}

.submission-form textarea {
  resize: vertical;
}

.complexity-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 4px 0 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.complexity-fields legend {
  padding: 0 5px;
  color: var(--muted);
  font-size: 12px;
}

.submission-explanation,
.submission-status,
.submission-error p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}

.save-button {
  justify-self: start;
}

.submission-status {
  color: var(--accent-strong);
}

.submission-error p {
  color: var(--danger);
}

.submission-error .text-button {
  margin-top: 3px;
}

.save-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 520px) {
  .submission-panel {
    padding: 16px;
  }

  .submission-heading {
    flex-direction: column;
  }

  .complexity-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
