<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import { computed, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { longestWindowCases } from '../../challenges/longest-window/cases';
import { longestWindowChallenge } from '../../challenges/longest-window/metadata';
import statementMarkdown from '../../challenges/longest-window/README.md?raw';
import starterSource from '../../challenges/longest-window/starter.ts?raw';
import ExampleExplorer from '../features/challenges/ExampleExplorer.vue';
import { demonstrateLongestWindow } from '../features/challenges/longest-window-demonstrator';
import { getChallenge } from '../features/challenges/registry';

const route = useRoute();
const challenge = computed(() => getChallenge(String(route.params.slug ?? '')));
const mode = ref<'interview' | 'learning'>('interview');
const hintsShown = ref(0);
const solutionSource = ref<string | null>(null);
const explanationHtml = ref<string | null>(null);
let learningMaterialGeneration = 0;

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });
const statementHtml = computed(() => {
  const titleLine = statementMarkdown.match(/^#[^\r\n]*/)?.[0];
  const duplicateTitle = titleLine === `# ${challenge.value?.title}`;
  const content = duplicateTitle
    ? statementMarkdown.slice(titleLine.length).replace(/^\r?\n+/, '')
    : statementMarkdown;

  return markdown.render(content);
});
const isLearningMode = computed(() => mode.value === 'learning');

function switchMode(nextMode: 'interview' | 'learning'): void {
  if (nextMode === mode.value) {
    return;
  }

  if (nextMode === 'learning') {
    const confirmed = window.confirm(
      'Learning Mode can reveal challenge topics, hints, the explanation, and reference solution. Continue?',
    );
    if (!confirmed) {
      return;
    }

    mode.value = nextMode;
    return;
  }

  mode.value = nextMode;
  learningMaterialGeneration += 1;
  hintsShown.value = 0;
  solutionSource.value = null;
  explanationHtml.value = null;
}

function showNextHint(): void {
  if (!challenge.value || !isLearningMode.value) {
    return;
  }
  hintsShown.value = Math.min(hintsShown.value + 1, challenge.value.learning.hints.length);
}

async function revealSolution(): Promise<void> {
  if (!isLearningMode.value || solutionSource.value !== null) {
    return;
  }

  const confirmed = window.confirm('The canonical reference solution is a spoiler. Reveal it now?');
  if (!confirmed) {
    return;
  }

  const generation = learningMaterialGeneration;
  const reference = await import('../../challenges/longest-window/solution.ts?raw');
  if (!isLearningMode.value || generation !== learningMaterialGeneration) {
    return;
  }
  solutionSource.value = reference.default;
}

async function revealExplanation(): Promise<void> {
  if (!isLearningMode.value || explanationHtml.value !== null) {
    return;
  }

  const confirmed = window.confirm('The reference explanation includes the approach and correctness reasoning. Reveal it now?');
  if (!confirmed) {
    return;
  }

  const generation = learningMaterialGeneration;
  const explanation = await import('../../challenges/longest-window/EXPLANATION.md?raw');
  if (!isLearningMode.value || generation !== learningMaterialGeneration) {
    return;
  }
  explanationHtml.value = markdown.render(explanation.default);
}
</script>

<template>
  <section class="page-section challenge-page" aria-labelledby="challenge-title">
    <p class="eyebrow">CHALLENGE</p>
    <template v-if="challenge">
      <header class="challenge-header">
        <div>
          <h1 id="challenge-title">{{ challenge.title }}</h1>
          <p class="challenge-objective">{{ challenge.objective }}</p>
          <div class="challenge-meta">
            <span class="difficulty-badge" :class="`difficulty-${challenge.difficulty}`">{{ challenge.difficulty }}</span>
            <span>{{ challenge.estimatedMinutes }} min</span>
            <span v-if="isLearningMode" class="challenge-tags" aria-label="Challenge topics">
              {{ challenge.tags.join(' · ') }}
            </span>
          </div>
        </div>

        <div class="mode-control" role="group" aria-label="Practice mode">
          <span class="small-legend">PRACTICE MODE</span>
          <div class="mode-buttons">
            <button
              type="button"
              aria-label="Interview mode"
              :aria-pressed="mode === 'interview'"
              @click="switchMode('interview')"
            >
              Interview Mode
            </button>
            <button
              type="button"
              aria-label="Learning mode"
              :aria-pressed="mode === 'learning'"
              @click="switchMode('learning')"
            >
              Learning Mode
            </button>
          </div>
          <p v-if="mode === 'interview'" class="mode-description">
            Hints, topic tags, and reference material are hidden. You can switch modes at any time.
          </p>
          <p v-else class="mode-description">
            Learning material is available on request. Returning to Interview Mode hides revealed material.
          </p>
        </div>
      </header>

      <div class="challenge-content-grid">
        <section class="challenge-panel statement-panel" aria-labelledby="statement-title">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">THE PROBLEM</p>
              <h2 id="statement-title">Problem statement</h2>
            </div>
            <RouterLink to="/explore" class="back-link">All challenges</RouterLink>
          </div>
          <div class="markdown-content" v-html="statementHtml" />
        </section>

        <div class="practice-content">
          <ExampleExplorer
            v-if="challenge.slug === 'longest-window'"
            class="challenge-panel"
            :cases="longestWindowCases"
            :example-case-ids="longestWindowChallenge.exampleCaseIds"
            :demonstrate="demonstrateLongestWindow"
          />

          <section class="challenge-panel starter-panel" aria-labelledby="starter-title">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">STARTER TEMPLATE</p>
                <h2 id="starter-title">{{ challenge.entryPoint }}.ts</h2>
              </div>
              <span class="language-label">TypeScript</span>
            </div>
            <pre class="starter-source"><code>{{ starterSource }}</code></pre>
            <div class="notice-panel" role="status">
              <h3>Practice workspace is not connected yet</h3>
              <p>Code editing, running tests, and saving are not available in this foundation.</p>
            </div>
          </section>
        </div>
      </div>

      <section v-if="isLearningMode" class="challenge-panel learning-panel" aria-labelledby="learning-title">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">LEARNING MODE</p>
            <h2 id="learning-title">Build your understanding</h2>
          </div>
          <span class="spoiler-note">Hints and references can reveal the intended approach.</span>
        </div>

        <section class="learning-section" aria-labelledby="hints-title">
          <h3 id="hints-title">Progressive hints</h3>
          <ol v-if="hintsShown > 0" class="hint-list">
            <li v-for="hint in challenge.learning.hints.slice(0, hintsShown)" :key="hint">{{ hint }}</li>
          </ol>
          <p v-else class="learning-copy">Reveal one hint at a time when you want a nudge.</p>
          <button
            v-if="hintsShown < challenge.learning.hints.length"
            type="button"
            class="secondary-button"
            :aria-label="`Show hint ${hintsShown + 1}`"
            @click="showNextHint"
          >
            Show hint {{ hintsShown + 1 }} of {{ challenge.learning.hints.length }}
          </button>
          <p v-else class="learning-copy">All three hints are revealed.</p>
        </section>

        <section class="learning-section" aria-labelledby="reference-explanation-title">
          <h3 id="reference-explanation-title">Reference explanation</h3>
          <button
            v-if="explanationHtml === null"
            type="button"
            class="secondary-button"
            aria-label="Reveal reference explanation"
            @click="revealExplanation"
          >
            Reveal explanation
          </button>
          <div v-else class="markdown-content reference-content" v-html="explanationHtml" />
        </section>

        <section class="learning-section" aria-labelledby="reference-solution-title">
          <h3 id="reference-solution-title">Canonical reference solution</h3>
          <p class="learning-copy">The reference source loads only after you confirm this reveal.</p>
          <button
            v-if="solutionSource === null"
            type="button"
            class="secondary-button"
            aria-label="Reveal reference solution"
            @click="revealSolution"
          >
            Reveal reference solution
          </button>
          <pre v-else class="starter-source reference-source"><code>{{ solutionSource }}</code></pre>
        </section>
      </section>
    </template>

    <template v-else>
      <h1 id="challenge-title">Challenge not found</h1>
      <div class="notice-panel notice-error" role="alert">
        <p>This challenge is not available in this catalog.</p>
        <p>The public catalog may still be empty, or the link may be incorrect.</p>
      </div>
      <RouterLink class="primary-button" to="/explore">Explore challenges</RouterLink>
    </template>
  </section>
</template>

<style scoped>
.challenge-page {
  max-width: 1180px;
}

.challenge-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 0.42fr);
  align-items: start;
  gap: 26px;
  margin-bottom: 22px;
}

.challenge-header h1 {
  max-width: 850px;
  margin: 0;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 730;
  letter-spacing: -0.055em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.challenge-meta {
  flex-wrap: wrap;
}

.challenge-tags {
  overflow-wrap: anywhere;
}

.mode-control {
  display: grid;
  justify-items: start;
  gap: 7px;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.small-legend,
.language-label {
  color: var(--subtle);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.mode-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 4px;
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}

.mode-buttons button {
  min-height: 38px;
  padding: 6px 11px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.mode-buttons button[aria-pressed="true"] {
  border-color: var(--border);
  color: var(--accent-strong);
  background: var(--surface);
}

.mode-description {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.challenge-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: start;
  gap: 18px;
}

.practice-content {
  display: grid;
  min-width: 0;
  gap: 18px;
}

.challenge-panel {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.panel-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.panel-heading .eyebrow {
  margin-bottom: 5px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}

.back-link {
  flex: 0 0 auto;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 650;
}

.markdown-content {
  min-width: 0;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.markdown-content :deep(h2) {
  margin: 22px 0 8px;
  color: var(--text);
  font-size: 17px;
}

.markdown-content :deep(h2:first-child) {
  margin-top: 0;
}

.markdown-content :deep(h3) {
  margin: 18px 0 7px;
  color: var(--text);
  font-size: 15px;
}

.markdown-content :deep(p),
.markdown-content :deep(ul) {
  margin: 8px 0;
}

.markdown-content :deep(ul) {
  padding-left: 21px;
}

.markdown-content :deep(li + li) {
  margin-top: 5px;
}

.markdown-content :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--surface-soft);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.93em;
}

.markdown-content :deep(pre) {
  max-width: 100%;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: #e1e5f0;
  background: var(--editor);
  white-space: pre;
}

.markdown-content :deep(pre code) {
  padding: 0;
  color: inherit;
  background: transparent;
}

.starter-panel {
  display: grid;
  gap: 12px;
}

.starter-panel .panel-heading {
  align-items: center;
  margin-bottom: 0;
}

.starter-source {
  max-width: 100%;
  min-width: 0;
  overflow: auto;
  margin: 0;
  padding: 14px;
  border: 1px solid #343b50;
  border-radius: var(--radius-control);
  color: #e1e5f0;
  background: var(--editor);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre;
}

.starter-source code {
  font: inherit;
}

.notice-panel {
  padding: 14px 16px;
}

.notice-panel h3 {
  margin: 0;
  font-size: 14px;
}

.notice-panel p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.learning-panel {
  display: grid;
  gap: 17px;
  margin-top: 18px;
}

.learning-panel > .panel-heading {
  align-items: center;
  margin: 0;
}

.spoiler-note,
.learning-copy {
  color: var(--muted);
  font-size: 12px;
}

.learning-section {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.learning-section h3 {
  margin: 0;
  font-size: 15px;
}

.learning-copy {
  margin: 0;
}

.hint-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 22px;
  color: var(--muted);
}

.secondary-button {
  min-height: 40px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--accent-strong);
  background: var(--surface-soft);
  font-weight: 650;
  cursor: pointer;
}

.reference-content {
  width: 100%;
}

.reference-source {
  width: 100%;
}

@media (max-width: 900px) {
  .challenge-header {
    grid-template-columns: minmax(0, 1fr);
    gap: 15px;
  }

  .mode-control {
    width: 100%;
  }

  .challenge-content-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 520px) {
  .challenge-panel {
    padding: 16px;
  }

  .panel-heading {
    flex-direction: column;
    gap: 8px;
  }

  .challenge-meta {
    align-items: flex-start;
  }
}
</style>
