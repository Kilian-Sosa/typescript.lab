<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { longestWindowSteps } from './longestWindowSteps';

const props = defineProps<{
  active: boolean;
  events: readonly string[];
  k: number;
  resetKey?: number | string;
}>();

const instanceId = useId();
const titleId = `${instanceId}-title`;
const eventsLabelId = `${instanceId}-events-label`;
const stateLabelId = `${instanceId}-state-label`;
const countsLabelId = `${instanceId}-counts-label`;
const steps = computed(() => longestWindowSteps(props.events, props.k));
const stepIndex = ref(0);
const currentStep = computed(() => steps.value[stepIndex.value] ?? steps.value[0]!);
const countsEntries = computed(() => Object.entries(currentStep.value.counts));
const currentWindowEndExclusive = computed(() => currentStep.value.right + 1);
const currentWindowRange = computed(
  () => `[${currentStep.value.left}, ${currentWindowEndExclusive.value})`,
);
const bestRange = computed(
  () => `[${currentStep.value.bestStart}, ${currentStep.value.bestEndExclusive})`,
);

watch(
  () => [props.active, props.events, props.k, props.resetKey] as const,
  () => {
    stepIndex.value = 0;
  },
  { deep: true, flush: 'sync' },
);

function isInCurrentWindow(index: number): boolean {
  return index >= currentStep.value.left && index < currentWindowEndExclusive.value;
}

function goToPreviousStep(): void {
  stepIndex.value = Math.max(0, stepIndex.value - 1);
}

function goToNextStep(): void {
  stepIndex.value = Math.min(steps.value.length - 1, stepIndex.value + 1);
}
</script>

<template>
  <section v-if="active" class="longest-window-stepper" :aria-labelledby="titleId">
    <div class="stepper-heading">
      <div>
        <p class="eyebrow">REFERENCE VISUALIZATION</p>
        <h2 :id="titleId">Step through the sliding window</h2>
      </div>
      <p class="reference-notice">
        This is a trace of the canonical reference approach for the challenge example. It does not read or run your
        editor code.
      </p>
    </div>

    <ol class="event-track" :aria-label="'Event positions and current window'" :aria-describedby="eventsLabelId">
      <li
        v-for="(event, index) in events"
        :key="`${index}-${event}`"
        class="event-cell"
        :class="{ 'is-in-window': isInCurrentWindow(index) }"
      >
        <span class="event-index">Index {{ index }}</span>
        <code>{{ event === '' ? '(empty string)' : event }}</code>
        <span class="event-window-state">
          {{ isInCurrentWindow(index) ? 'In current window' : 'Outside current window' }}
        </span>
        <span v-if="currentStep.left === index" class="pointer-label">Left pointer</span>
        <span v-if="currentStep.right === index" class="pointer-label">Right pointer</span>
      </li>
    </ol>
    <p :id="eventsLabelId" class="visually-hidden">
      The event list shows the current window and names each pointer in text.
    </p>

    <div class="stepper-controls">
      <button
        type="button"
        :aria-controls="stateLabelId"
        aria-label="Previous reference step"
        :disabled="stepIndex === 0"
        @click="goToPreviousStep"
      >
        Previous
      </button>
      <p class="step-count" data-testid="visualizer-step-status">Step {{ stepIndex + 1 }} of {{ steps.length }}</p>
      <button
        type="button"
        :aria-controls="stateLabelId"
        aria-label="Next reference step"
        :disabled="stepIndex === steps.length - 1"
        @click="goToNextStep"
      >
        Next
      </button>
    </div>

    <div :id="stateLabelId" class="reference-state">
      <h3 :id="stateLabelId + '-heading'">Current reference state</h3>
      <dl>
        <div>
          <dt>Left pointer</dt>
          <dd data-testid="visualizer-left-pointer">{{ currentStep.left }}</dd>
        </div>
        <div>
          <dt>Right pointer</dt>
          <dd data-testid="visualizer-right-pointer">
            {{ currentStep.right < 0 ? 'Before scanning' : currentStep.right }}
          </dd>
        </div>
        <div>
          <dt>Current window range</dt>
          <dd>{{ currentWindowRange }}</dd>
        </div>
        <div>
          <dt>Best range so far</dt>
          <dd data-testid="visualizer-best-range">{{ bestRange }}</dd>
        </div>
      </dl>

      <div class="counts-panel">
        <h4 :id="countsLabelId">Event counts</h4>
        <ul v-if="countsEntries.length > 0" :aria-labelledby="countsLabelId" data-testid="visualizer-counts">
          <li v-for="[event, count] in countsEntries" :key="event">
            <code>{{ event === '' ? '(empty string)' : event }}</code
            >: {{ count }}
          </li>
        </ul>
        <p v-else>No event identifiers are in the current window.</p>
      </div>
    </div>

    <p
      class="step-explanation"
      data-testid="visualizer-explanation"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ currentStep.explanation }}
    </p>
  </section>
</template>

<style scoped>
.longest-window-stepper {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.stepper-heading {
  display: grid;
  min-width: 0;
  gap: 7px;
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
  font-size: 19px;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}

.reference-notice {
  max-width: 68ch;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.event-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.event-cell {
  display: grid;
  min-width: 0;
  min-height: 105px;
  align-content: start;
  gap: 6px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface);
  transition: background-color 150ms ease, border-color 150ms ease;
}

.event-cell.is-in-window {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.event-cell code,
.reference-state code {
  overflow-wrap: anywhere;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.event-index,
.event-window-state,
.pointer-label {
  color: var(--text);
  font-size: 11px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.event-window-state {
  font-weight: 600;
}

.pointer-label {
  color: var(--accent-strong);
  font-weight: 750;
}

.stepper-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.stepper-controls button {
  min-height: 42px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--accent-strong);
  background: var(--surface-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.stepper-controls button:first-child {
  justify-self: start;
}

.stepper-controls button:last-child {
  justify-self: end;
}

.stepper-controls button:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.stepper-controls button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.step-count {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.reference-state {
  display: grid;
  min-width: 0;
  gap: 11px;
}

.reference-state h3,
.counts-panel h4 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
}

.reference-state dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 8px;
  margin: 0;
}

.reference-state dl > div {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}

.reference-state dt {
  color: var(--muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.reference-state dd {
  margin: 4px 0 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.counts-panel {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.counts-panel ul {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 14px;
  margin: 0;
  padding-left: 20px;
  color: var(--text);
  font-size: 13px;
}

.counts-panel p {
  margin: 0;
  color: var(--text);
  font-size: 13px;
}

.step-explanation {
  margin: 0;
  padding: 12px;
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  color: var(--text);
  background: var(--surface-soft);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
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
  .longest-window-stepper {
    gap: 13px;
  }

  .event-track {
    gap: 6px;
  }

  .event-cell {
    padding: 7px;
  }

  .stepper-controls {
    gap: 6px;
  }

  .stepper-controls button {
    padding-inline: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .event-cell {
    transition: none;
  }
}
</style>
