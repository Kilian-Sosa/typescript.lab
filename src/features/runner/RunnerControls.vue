<script setup lang="ts">
import { inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { RunResult } from '../../../shared/contracts/v1';
import { createIframeRunner, hostedQaRunnerOrigin, localRunnerOrigin, mvpPreviewRunnerOrigin,
  newRunId, runOutcome } from './runChallenge';
import { runChallengeKey } from './session';
import TestResults from './TestResults.vue';

const props = defineProps<{ source: string; challengeId: string; challengeVersion: string; resetKey?: number }>();
const origin = localRunnerOrigin(import.meta.env.DEV, import.meta.env.VITE_ENABLE_LOCAL_RUNNER,
  import.meta.env.VITE_RUNNER_ORIGIN, window.location.origin)
  ?? hostedQaRunnerOrigin(import.meta.env.MODE, import.meta.env.VITE_ENABLE_M3_QA_RUNNER,
    import.meta.env.VITE_RUNNER_ORIGIN, window.location.origin, import.meta.env.DEV,
    import.meta.env.VITE_M3_QA_DEPLOYMENT_ENV)
  ?? mvpPreviewRunnerOrigin(import.meta.env.MODE, import.meta.env.VITE_ENABLE_MVP_PREVIEW_RUNNER,
    import.meta.env.VITE_RUNNER_ORIGIN, window.location.origin, import.meta.env.DEV,
    import.meta.env.VITE_MVP_PREVIEW_DEPLOYMENT_ENV);
const runChallenge = inject(runChallengeKey, null) ?? (origin ? createIframeRunner(origin) : null);
const result = shallowRef<RunResult | null>(null);
const stale = ref(false);
const running = ref(false);
const runButton = ref<HTMLButtonElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
let revision = 0;
let generation = 0;
let controller: AbortController | null = null;

function invalidate() {
  generation++; revision++; controller?.abort(); controller = null;
  result.value = null; running.value = false; stale.value = true;
}
watch(() => [props.source, props.challengeId, props.challengeVersion, props.resetKey], invalidate, { flush: 'sync' });
onBeforeUnmount(invalidate);

function cancel() {
  const restoreFocus = document.activeElement === cancelButton.value;
  controller?.abort();
  if (restoreFocus) runButton.value?.focus();
}

async function run() {
  if (!runChallenge || running.value) return;
  const epoch = ++generation;
  const source = props.source, challengeId = props.challengeId;
  const context = { runId: newRunId(), sourceRevision: revision, challengeVersion: props.challengeVersion };
  controller = new AbortController();
  running.value = true; stale.value = false;
  result.value = runOutcome(challengeId, context, 'running', '');
  try {
    const next = await runChallenge(source, challengeId, context, controller.signal);
    if (epoch !== generation) return;
    if (next.runId !== context.runId || next.sourceRevision !== revision || next.challengeId !== props.challengeId
      || next.challengeVersion !== props.challengeVersion || props.source !== source) return;
    result.value = next;
  } catch {
    if (epoch === generation) result.value = runOutcome(challengeId, context, 'infrastructure-error', 'Runner could not start. Retry Run tests.');
  } finally {
    if (epoch === generation) { running.value = false; controller = null; }
  }
}
</script>

<template>
  <div class="runner-controls">
    <div class="run-actions">
      <button ref="runButton" type="button" class="primary-button" aria-label="Run tests" :disabled="!runChallenge" :aria-disabled="running" @click="run">Run tests</button>
      <button v-if="running" ref="cancelButton" type="button" class="text-button" aria-label="Cancel test run" @click="cancel">Cancel run</button>
    </div>
    <p v-if="!runChallenge" class="runner-gate">Run tests is unavailable on this deployment. The isolated runner must be enabled on an approved app/runner origin pair. Your source can still be edited and saved.</p>
    <TestResults :result="result" :stale="stale" />
  </div>
</template>

<style scoped>
.runner-controls { display: grid; gap: 10px; min-width: 0; }
.run-actions { display: flex; flex-wrap: wrap; gap: 10px; }
button { min-height: 44px; }
.runner-gate { margin: 0; font-size: 12px; color: var(--muted); }
</style>
