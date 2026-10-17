<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  active: boolean;
  challengeVersion: string;
  hints: readonly [string, string, string];
  resetKey?: number | string;
}>();

const revealedCount = ref(0);
const revealedHints = computed(() => props.hints.slice(0, revealedCount.value));
const latestAnnouncement = computed(() => {
  if (revealedCount.value === 0) {
    return '';
  }

  return `Hint ${revealedCount.value} of ${props.hints.length} revealed: ${props.hints[revealedCount.value - 1]}`;
});

watch(
  () => [props.active, props.challengeVersion, props.hints, props.resetKey] as const,
  () => {
    revealedCount.value = 0;
  },
  { flush: 'sync' },
);

function revealNextHint(): void {
  if (!props.active) {
    return;
  }

  revealedCount.value = Math.min(revealedCount.value + 1, props.hints.length);
}
</script>

<template>
  <section v-if="active" class="learning-hints" aria-labelledby="learning-hints-title">
    <div>
      <p class="eyebrow">LEARNING MODE</p>
      <h2 id="learning-hints-title">Progressive hints</h2>
      <p class="learning-hints-copy">Reveal one hint at a time when you want a nudge.</p>
    </div>

    <ol v-if="revealedCount > 0" class="learning-hints-list">
      <li v-for="(hint, index) in revealedHints" :key="`${challengeVersion}-${index}`">
        {{ hint }}
      </li>
    </ol>

    <button
      v-if="revealedCount < hints.length"
      type="button"
      class="learning-hints-button"
      :aria-label="`Show hint ${revealedCount + 1}`"
      @click="revealNextHint"
    >
      Show hint {{ revealedCount + 1 }} of {{ hints.length }}
    </button>
    <p v-else class="learning-hints-copy">All three hints are revealed.</p>

    <p v-if="latestAnnouncement" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {{ latestAnnouncement }}
    </p>
  </section>
</template>

<style scoped>
.learning-hints {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--subtle);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}

.learning-hints-copy {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.learning-hints-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 22px;
  color: var(--text);
}

.learning-hints-list li {
  padding-left: 2px;
  overflow-wrap: anywhere;
}

.learning-hints-button {
  justify-self: start;
  min-height: 42px;
  padding: 8px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--accent-strong);
  background: var(--surface-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.learning-hints-button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
  border: 0;
}

@media (max-width: 520px) {
  .learning-hints {
    gap: 10px;
  }
}
</style>
