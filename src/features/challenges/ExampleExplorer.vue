<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChallengeCase } from '../../../shared/contracts/v1';
import type { LongestWindowInput, LongestWindowOutput } from '../../../challenges/longest-window/cases';

const props = defineProps<{
  cases: readonly ChallengeCase<LongestWindowInput, LongestWindowOutput>[];
  exampleCaseIds: readonly string[];
  demonstrate: (input: LongestWindowInput) => LongestWindowOutput;
}>();

const exampleCases = computed(() => props.exampleCaseIds
  .map((caseId) => props.cases.find((testCase) => testCase.id === caseId))
  .filter((testCase): testCase is ChallengeCase<LongestWindowInput, LongestWindowOutput> =>
    testCase !== undefined));
const selectedCaseId = ref(exampleCases.value[0]?.id ?? '');
const selectedCase = computed(() => exampleCases.value.find((testCase) => testCase.id === selectedCaseId.value));
const eventsJson = ref(JSON.stringify(selectedCase.value?.input.events ?? [], null, 2));
const limitText = ref(String(selectedCase.value?.input.k ?? 0));

function updateLimit(event: Event): void {
  limitText.value = (event.target as HTMLInputElement).value;
}

watch(selectedCase, (testCase) => {
  if (testCase) {
    eventsJson.value = JSON.stringify(testCase.input.events, null, 2);
    limitText.value = String(testCase.input.k);
  }
});

const parsedInput = computed(() => {
  let events: unknown;
  try {
    events = JSON.parse(eventsJson.value) as unknown;
  } catch {
    return { error: { field: 'events', message: 'Enter valid JSON containing an array of strings.' } } as const;
  }

  if (!Array.isArray(events) || events.some((event) => typeof event !== 'string')) {
    return { error: { field: 'events', message: 'Enter a JSON array of strings for the event identifiers.' } } as const;
  }

  if (events.length > 100_000) {
    return { error: { field: 'events', message: 'Enter no more than 100,000 event identifiers.' } } as const;
  }

  if (limitText.value.trim() === '') {
    return { error: { field: 'limit', message: 'Enter a finite number for k.' } } as const;
  }

  const k = Number(limitText.value);
  if (!Number.isFinite(k)) {
    return { error: { field: 'limit', message: 'Enter a finite number for k.' } } as const;
  }

  return { input: { events: events as string[], k } } as const;
});

const validationError = computed(() => 'error' in parsedInput.value ? parsedInput.value.error : null);
const output = computed(() => 'error' in parsedInput.value
  ? undefined
  : props.demonstrate(parsedInput.value.input));
const outputText = computed(() => output.value
  ? `{ start: ${output.value.start}, endExclusive: ${output.value.endExclusive} }`
  : '');
</script>

<template>
  <section class="example-explorer" aria-labelledby="example-explorer-title">
    <div class="example-explorer-heading">
      <div>
        <p class="eyebrow">EXAMPLE EXPLORER</p>
        <h2 id="example-explorer-title">Try different inputs</h2>
      </div>
      <label class="field-label preset-field">
        <span>Example preset</span>
        <select v-model="selectedCaseId" aria-label="Example preset">
          <option v-for="testCase in exampleCases" :key="testCase.id" :value="testCase.id">
            {{ testCase.name }}
          </option>
        </select>
      </label>
    </div>

    <p class="example-explainer">
      Edit the JSON array and finite numeric limit to explore the expected result. The output comes from the canonical
      reference for these example inputs; it does not run or assess editor code.
    </p>

    <div class="example-inputs">
      <label class="field-label" for="example-events-json">Event identifiers as JSON</label>
      <textarea
        id="example-events-json"
        v-model="eventsJson"
        rows="7"
        spellcheck="false"
        :aria-invalid="validationError?.field === 'events' ? 'true' : 'false'"
        :aria-describedby="validationError?.field === 'events'
          ? 'example-input-help example-validation-error'
          : 'example-input-help'"
      />
      <label class="field-label" for="example-limit">Maximum distinct identifiers</label>
      <input
        id="example-limit"
        :value="limitText"
        type="number"
        step="any"
        aria-label="Maximum distinct identifiers"
        :aria-invalid="validationError?.field === 'limit' ? 'true' : 'false'"
        :aria-describedby="validationError?.field === 'limit'
          ? 'example-input-help example-validation-error'
          : 'example-input-help'"
        @input="updateLimit"
      />
      <p id="example-input-help" class="example-input-help">
        Positive fractional limits allow at most their whole-number floor. Empty arrays and non-positive limits return
        an empty range.
      </p>
      <p v-if="validationError" id="example-validation-error" class="example-error" role="alert">
        {{ validationError.message }}
      </p>
    </div>

    <div v-if="output" class="example-output-panel" aria-live="polite">
      <span class="small-legend">EXPECTED OUTPUT FROM EXAMPLE</span>
      <code data-testid="example-output">{{ outputText }}</code>
    </div>
  </section>
</template>

<style scoped>
.example-explorer {
  min-width: 0;
}

.example-explorer-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.example-explorer-heading .eyebrow {
  margin-bottom: 5px;
}

.example-explorer-heading h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.035em;
}

.preset-field {
  width: min(100%, 250px);
}

.example-explainer,
.example-input-help {
  color: var(--muted);
  font-size: 13px;
}

.example-inputs {
  display: grid;
  gap: 7px;
  margin-top: 17px;
}

.example-inputs textarea,
.example-inputs input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  color: var(--text);
  background: var(--surface);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.example-inputs textarea {
  resize: vertical;
}

.example-input-help {
  margin: 2px 0 0;
}

.example-error {
  margin: 2px 0 0;
  color: var(--danger);
  font-size: 13px;
  font-weight: 650;
}

.example-output-panel {
  display: grid;
  gap: 6px;
  margin-top: 17px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}

.example-output-panel code {
  overflow-wrap: anywhere;
  color: var(--success);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 650;
}

.small-legend {
  color: var(--subtle);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

@media (max-width: 600px) {
  .example-explorer-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .preset-field {
    width: 100%;
  }
}
</style>
