<script setup lang="ts">
import { computed } from 'vue';
import type { RunFeedback } from './runChallenge';
const props = defineProps<{ result: RunFeedback | null; stale: boolean }>();
const output = computed(() => props.result?.reason === 'cancelled' ? undefined : props.result?.consoleOutput);
const summary = computed(() => {
  if (!props.result) return props.stale ? 'Console cleared. Run tests again for the current source.' : 'Run tests to capture console output.';
  if (props.result.reason === 'cancelled') return 'Console cleared. Run cancelled.';
  if (props.result.status === 'running') return 'Console output will be available when this run finishes.';
  if (!output.value) return 'Console output is unavailable for this run. The runner may have stopped before capture completed or may need updating.';
  const count = output.value.entries.length;
  return count ? `${count} console ${count === 1 ? 'message' : 'messages'}.` : 'No console messages were produced by this run.';
});
</script>

<template>
  <section class="console-output" aria-label="Console output" :aria-busy="result?.status === 'running'">
    <h3>Console</h3>
    <p class="console-summary" aria-live="polite" aria-atomic="true">{{ summary }}</p>
    <p v-if="result" class="console-context">Run <code>{{ result.runId }}</code> · Revision {{ result.sourceRevision }} · {{ result.status }}</p>
    <p v-if="output?.truncated" class="console-limit">Console output was truncated to stay within display limits.</p>
    <div v-if="output?.entries.length" class="console-messages" role="region" aria-label="Console messages" tabindex="0">
      <ol>
        <li v-for="entry in output.entries" :key="entry.sequence">
          <span class="console-level">{{ entry.level }}</span> <span class="console-case">{{ entry.caseId }}</span>
          <pre>{{ entry.text }}</pre>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.console-output { min-width: 0; padding-top: 12px; border-top: 1px solid var(--border); }
h3 { margin: 0 0 8px; font-size: 14px; }
p { margin: 6px 0; font-size: 12px; color: var(--muted); }
.console-context { overflow-wrap: anywhere; }
.console-messages { max-height: 300px; overflow: auto; margin-top: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--editor); color: #edf0fa; }
.console-messages:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 3px; }
ol { list-style: none; margin: 0; padding: 0; }
li + li { border-top: 1px solid #343b50; margin-top: 10px; padding-top: 10px; }
.console-level { font-weight: 750; font-size: 12px; }
.console-case { font-size: 11px; overflow-wrap: anywhere; }
pre { margin: 5px 0 0; font: 12px/1.6 var(--font-mono, monospace); white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
