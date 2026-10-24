<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { SolutionAttempt } from '../../shared/contracts/v1';
import AttemptComparison from '../features/solutions/AttemptComparison.vue';
import AttemptTimeline from '../features/solutions/AttemptTimeline.vue';
import {
  AuthenticationRequiredError,
  type AttemptRepository,
} from '../features/solutions/attemptRepository';
import { exportAttempts } from '../features/solutions/exportAttempts';
import { findChallenge } from '../features/challenges/registry';
import { attemptRepositoryKey, notebookSessionKey } from '../features/solutions/session';
import { authControllerKey } from '../features/auth/auth';
import { evaluationLabel } from '../features/solutions/evaluationLabel';

type PageState = 'loading' | 'ready' | 'empty' | 'unconfigured' | 'signed-out' | 'error';
type ExportFormat = 'typescript' | 'markdown' | 'json';

const repository = inject<AttemptRepository | null>(attemptRepositoryKey, null);
const session = inject(notebookSessionKey, null);
const auth = inject(authControllerKey, null);
const route = useRoute();
const router = useRouter();
const slug = computed(() => typeof route.params.slug === 'string' ? route.params.slug : '');
const challenge = computed(() => findChallenge(slug.value));
const title = computed(() => challenge.value?.title ?? slug.value);
const state = ref<PageState>('loading');
const attempts = ref<SolutionAttempt[]>([]);
const selectedAttemptId = ref('');
const showingComparison = ref(false);
const exportError = ref('');
let unsubscribeSession: (() => void) | undefined;
let loadRevision = 0;

const orderedAttempts = computed(() => [...attempts.value].sort((left, right) =>
  right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)));

const selectedAttempt = computed(() =>
  orderedAttempts.value.find((attempt) => attempt.id === selectedAttemptId.value));

const selectedAttemptNumber = computed(() => {
  const index = orderedAttempts.value.findIndex((attempt) => attempt.id === selectedAttemptId.value);
  return index < 0 ? 0 : orderedAttempts.value.length - index;
});

const comparison = computed(() => {
  if (!selectedAttempt.value || orderedAttempts.value.length < 2) {
    return null;
  }
  const selectedIndex = orderedAttempts.value.findIndex((attempt) => attempt.id === selectedAttemptId.value);
  if (selectedIndex < 0) {
    return null;
  }
  if (selectedIndex === 0) {
    return { earlier: orderedAttempts.value[1]!, later: orderedAttempts.value[0]! };
  }
  return { earlier: orderedAttempts.value[selectedIndex]!, later: orderedAttempts.value[selectedIndex - 1]! };
});

const versionNotice = computed(() => {
  if (!selectedAttempt.value) {
    return '';
  }
  if (!challenge.value) {
    return `This saved source belongs to challenge version ${selectedAttempt.value.challengeVersion}. The current challenge definition is unavailable.`;
  }
  if (selectedAttempt.value.challengeVersion === challenge.value.version) {
    return '';
  }
  return `This attempt was saved with challenge version ${selectedAttempt.value.challengeVersion}. The current challenge is version ${challenge.value.version}; the saved source and notes remain unchanged. The original challenge statement for that revision is unavailable in this build.`;
});

function clearAndReload(): void {
  attempts.value = [];
  selectedAttemptId.value = '';
  showingComparison.value = false;
  exportError.value = '';
  void loadAttempts();
}

async function loadAttempts(): Promise<void> {
  const currentRevision = ++loadRevision;
  const challengeId = slug.value;
  attempts.value = [];
  selectedAttemptId.value = '';

  if (auth && !auth.state.userId) { state.value = 'signed-out'; return; }

  if (!repository) {
    state.value = 'unconfigured';
    return;
  }

  state.value = 'loading';
  try {
    const loadedAttempts = await repository.listAttempts(challengeId);
    if (currentRevision !== loadRevision || challengeId !== slug.value) {
      return;
    }
    attempts.value = loadedAttempts
      .filter((attempt) => attempt.challengeId === challengeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    selectedAttemptId.value = attempts.value[0]?.id ?? '';
    state.value = attempts.value.length > 0 ? 'ready' : 'empty';
  } catch (error) {
    if (currentRevision !== loadRevision || challengeId !== slug.value) {
      return;
    }
    attempts.value = [];
    selectedAttemptId.value = '';
    state.value = error instanceof AuthenticationRequiredError ? 'signed-out' : 'error';
  }
}

function selectAttempt(attemptId: string): void {
  selectedAttemptId.value = attemptId;
  showingComparison.value = false;
}

function signIn(): void {
  if (!session) {
    return;
  }
  const returnTo = `/notebook/${encodeURIComponent(slug.value)}`;
  void session.signInWithGitHub(returnTo).catch(() => {
    state.value = 'error';
  });
}

function downloadAttempt(format: ExportFormat): void {
  exportError.value = '';
  if (!selectedAttempt.value) {
    return;
  }
  try {
    const files = exportAttempts([selectedAttempt.value]);
    const file = files[0]?.[format];
    if (!file) {
      throw new Error('The requested export format is unavailable.');
    }

    const objectUrl = URL.createObjectURL(new Blob([file.content], { type: file.mediaType }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  } catch {
    exportError.value = 'This attempt could not be exported. Try again.';
  }
}

function freshToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function retryFromScratch(): void {
  void router.push({
    name: 'challenge',
    params: { slug: slug.value },
    query: { fresh: freshToken() },
  });
}

onMounted(() => {
  if (repository) {
    unsubscribeSession = repository.subscribeToSessionChanges(clearAndReload);
  }
  void loadAttempts();
});

watch(slug, () => {
  showingComparison.value = false;
  void loadAttempts();
});
watch(() => auth?.state.userId, clearAndReload, { flush: 'sync' });

onBeforeUnmount(() => {
  loadRevision += 1;
  unsubscribeSession?.();
});
</script>

<template>
  <section class="page-section notebook-detail" aria-labelledby="notebook-detail-title">
    <header class="detail-heading">
      <div>
        <p class="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p>
        <h1 id="notebook-detail-title">{{ title }}<span class="accent-period">.</span></h1>
        <p class="page-intro">Saved attempts keep their exact source, notes, and challenge revision.</p>
      </div>
      <RouterLink class="secondary-button back-link" to="/notebook">Back to notebook</RouterLink>
    </header>

    <p v-if="state === 'loading'" class="notice-panel" role="status">Loading your private attempts…</p>

    <section
      v-else-if="state === 'unconfigured' || state === 'signed-out'"
      class="notice-panel guest-gate"
      aria-labelledby="detail-gate-title"
    >
      <div>
        <h2 id="detail-gate-title">Sign in to view this challenge’s attempts</h2>
        <p v-if="state === 'unconfigured'">
          Private notebook access needs the public Supabase URL and publishable key in this environment. No saved source
          is shown.
        </p>
        <p v-else>Sign in to load private history. No saved source is available while signed out.</p>
        <button
          v-if="state === 'signed-out' && session"
          class="primary-button"
          type="button"
          aria-label="Sign in with GitHub"
          @click="signIn"
        >
          Sign in with GitHub
        </button>
      </div>
    </section>

    <section v-else-if="state === 'error'" class="notice-panel notice-error" role="alert">
      <h2>Could not verify this attempt history</h2>
      <p>Saved source is hidden because the private history could not be verified.</p>
      <button class="secondary-button" type="button" @click="loadAttempts">Try again</button>
    </section>

    <section v-else-if="state === 'empty'" class="empty-state" aria-labelledby="detail-empty-title">
      <span class="empty-state-mark" aria-hidden="true">01</span>
      <h2 id="detail-empty-title">No saved attempts for this challenge</h2>
      <p>Save an attempt from the challenge page to keep its source and learning notes here.</p>
      <RouterLink class="primary-button" :to="{ name: 'challenge', params: { slug } }">Open challenge</RouterLink>
    </section>

    <div v-else class="detail-layout">
      <AttemptTimeline
        :attempts="orderedAttempts"
        :selected-attempt-id="selectedAttemptId"
        :current-challenge-version="challenge?.version"
        @select="selectAttempt"
      />

      <article v-if="selectedAttempt" class="attempt-detail" aria-label="Saved attempt details">
        <header class="attempt-heading">
          <div>
            <p class="eyebrow">ATTEMPT {{ selectedAttemptNumber }} OF {{ orderedAttempts.length }}</p>
            <h2>Saved solution</h2>
          </div>
          <span class="attempt-status-label">{{ evaluationLabel(selectedAttempt.testSummary) }}</span>
        </header>

        <p class="attempt-version">Challenge version {{ selectedAttempt.challengeVersion }}</p>
        <p v-if="versionNotice" class="version-notice" role="note">{{ versionNotice }}</p>

        <section class="saved-section" aria-labelledby="saved-source-heading">
          <div class="section-heading-row">
            <h3 id="saved-source-heading">Saved TypeScript source</h3>
            <button
              class="text-button"
              type="button"
              aria-label="Download TypeScript source"
              @click="downloadAttempt('typescript')"
            >
              Download .ts
            </button>
          </div>
          <pre aria-label="Saved TypeScript source"><code>{{ selectedAttempt.source }}</code></pre>
        </section>

        <section class="saved-section" aria-labelledby="saved-notes-heading">
          <div class="section-heading-row">
            <h3 id="saved-notes-heading">Learning notes</h3>
            <div class="export-actions" aria-label="Export attempt">
              <button
                class="text-button"
                type="button"
                aria-label="Download Markdown"
                @click="downloadAttempt('markdown')"
              >
                Markdown
              </button>
              <button class="text-button" type="button" aria-label="Download JSON" @click="downloadAttempt('json')">
                JSON
              </button>
            </div>
          </div>
          <p class="saved-notes">{{ selectedAttempt.notes || 'No learning notes were saved.' }}</p>
        </section>

        <dl class="complexity-history">
          <div>
            <dt>Declared time complexity</dt>
            <dd>{{ selectedAttempt.timeComplexity ?? 'Not recorded' }}</dd>
          </div>
          <div>
            <dt>Declared space complexity</dt>
            <dd>{{ selectedAttempt.spaceComplexity ?? 'Not recorded' }}</dd>
          </div>
          <div>
            <dt>Saved evaluation</dt>
            <dd>{{ evaluationLabel(selectedAttempt.testSummary) }}</dd>
          </div>
        </dl>

        <div class="attempt-actions">
          <button
            v-if="comparison"
            class="secondary-button"
            type="button"
            aria-label="Compare versions"
            :aria-expanded="showingComparison"
            @click="showingComparison = !showingComparison"
          >
            {{ showingComparison ? 'Hide comparison' : 'Compare with earlier attempt' }}
          </button>
          <button class="primary-button" type="button" aria-label="Retry from scratch" @click="retryFromScratch">
            Retry from scratch
          </button>
        </div>
        <p v-if="exportError" class="export-error" role="alert">{{ exportError }}</p>

        <AttemptComparison
          v-if="showingComparison && comparison"
          :earlier="comparison.earlier"
          :later="comparison.later"
        />
      </article>
    </div>
  </section>
</template>

<style scoped>
.notebook-detail {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.detail-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
}

.detail-heading h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 730;
  letter-spacing: -0.055em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.detail-heading .eyebrow {
  margin-bottom: 9px;
}

.detail-heading .page-intro {
  margin-top: 10px;
}

.back-link {
  flex: 0 0 auto;
  text-decoration: none;
}

.notebook-detail .secondary-button,
.notebook-detail .back-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--accent-strong);
  background: var(--surface-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.notebook-detail .secondary-button:hover,
.notebook-detail .back-link:hover {
  border-color: var(--accent-strong);
  background: var(--surface);
}

.notebook-detail .secondary-button:focus-visible,
.notebook-detail .back-link:focus-visible {
  outline: 3px solid var(--accent-strong);
  outline-offset: 2px;
}

.guest-gate h2,
.notice-error h2 {
  margin: 0;
  font-size: 17px;
}

.guest-gate .primary-button {
  margin-top: 12px;
}

.notice-error .secondary-button {
  margin-top: 12px;
}

.empty-state .primary-button {
  margin-top: 14px;
  text-decoration: none;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  min-width: 0;
}

.attempt-detail {
  display: grid;
  gap: 17px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.attempt-heading,
.section-heading-row {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.attempt-heading .eyebrow {
  margin-bottom: 5px;
}

.attempt-heading h2 {
  margin: 0;
  font-size: 19px;
}

.attempt-status-label {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
}

.attempt-version,
.version-notice {
  margin: -9px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}

.version-notice {
  padding: 10px 12px;
  border-left: 3px solid var(--accent-strong);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  background: var(--surface-soft);
}

.saved-section {
  display: grid;
  gap: 9px;
  min-width: 0;
}

.section-heading-row {
  align-items: center;
}

.section-heading-row h3 {
  margin: 0;
  font-size: 14px;
}

.saved-section pre {
  overflow: auto;
  max-width: 100%;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--text);
  background: var(--surface-soft);
  font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: pre;
  tab-size: 2;
}

.saved-section pre code {
  color: inherit;
}

.saved-notes {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.complexity-history {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.complexity-history div {
  min-width: 0;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}

.complexity-history dt {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
}

.complexity-history dd {
  margin: 5px 0 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.attempt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.export-error {
  margin: -8px 0 0;
  color: var(--danger);
  font-size: 12px;
}

@media (max-width: 800px) {
  .detail-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 620px) {
  .detail-heading {
    align-items: start;
    flex-direction: column;
  }

  .attempt-detail {
    padding: 15px;
  }

  .complexity-history {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
