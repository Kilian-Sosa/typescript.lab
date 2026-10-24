<script setup lang="ts">
import type { SolutionAttempt } from '../../../shared/contracts/v1';
import { evaluationLabel } from './evaluationLabel';

defineProps<{
  attempts: readonly SolutionAttempt[];
  selectedAttemptId: string;
  currentChallengeVersion?: string | undefined;
}>();

const emit = defineEmits<{
  select: [attemptId: string];
}>();

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function attemptNumber(attempts: readonly SolutionAttempt[], index: number): number {
  return attempts.length - index;
}
</script>

<template>
  <nav class="attempt-timeline" aria-label="Attempt history">
    <h2>Attempt history</h2>
    <ol>
      <li v-for="(attempt, index) in attempts" :key="attempt.id">
        <button
          class="timeline-item"
          type="button"
          :aria-current="attempt.id === selectedAttemptId ? 'true' : undefined"
          :aria-label="`Open attempt ${attemptNumber(attempts, index)}, version ${attempt.challengeVersion}, ${formatDate(attempt.createdAt)}`"
          @click="emit('select', attempt.id)"
        >
          <span class="timeline-item-heading">Attempt {{ attemptNumber(attempts, index) }}</span>
          <span class="timeline-item-version">
            {{ attempt.challengeVersion !== currentChallengeVersion ? 'Older challenge version' : 'Challenge version' }}
            {{ attempt.challengeVersion }}
          </span>
          <time class="timeline-item-date" :datetime="attempt.createdAt">{{ formatDate(attempt.createdAt) }}</time>
          <span class="timeline-item-version">{{ evaluationLabel(attempt.testSummary) }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.attempt-timeline {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.attempt-timeline h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

.attempt-timeline ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline-item {
  display: grid;
  width: 100%;
  gap: 4px;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--text);
  background: var(--surface-soft);
  text-align: left;
  cursor: pointer;
}

.timeline-item[aria-current="true"] {
  border-color: var(--accent-strong);
  box-shadow: inset 3px 0 var(--accent-strong);
}

.timeline-item:focus-visible {
  outline: 3px solid var(--accent-strong);
  outline-offset: 2px;
}

.timeline-item-heading {
  font-size: 13px;
  font-weight: 700;
}

.timeline-item-version,
.timeline-item-date {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
