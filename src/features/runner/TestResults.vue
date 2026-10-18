<script setup lang="ts">
import { computed } from 'vue';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import type { RunResult } from '../../../shared/contracts/v1';
const props = defineProps<{ result: RunResult | null; stale?: boolean }>();
const title = computed(() => {
  if (!props.result) return props.stale ? 'Tests have not run. Source changed. Run tests again.' : 'Tests have not run';
  if (props.result.reason === 'cancelled') return 'Run cancelled';
  if (props.result.reason === 'policy-rejected' || props.result.reason === 'unsupported-code') return 'Code is unsupported';
  return { 'not-run': 'Tests have not run', running: 'Running tests…', passed: `All ${props.result.cases.length} tests passed`,
    failed: 'Tests failed', 'compile-error': 'Compilation failed', timeout: 'Run timed out',
    'execution-error': 'Execution failed', 'infrastructure-error': 'Runner unavailable' }[props.result.status];
});
const label = (id: string) => longestWindowCases.find(c => c.id === id)?.name ?? id;
</script>

<template>
  <section class="test-results" aria-label="Test feedback" :aria-busy="result?.status === 'running'">
    <p id="execution-status" role="status" aria-live="polite" aria-atomic="true">{{ title }}</p>
    <p v-if="result?.status === 'infrastructure-error'">Your code is preserved; retry Run tests.</p>
    <p v-if="result?.status === 'timeout'">The execution limit was reached. Check for loops or expensive operations and try again.</p>
    <ul v-if="result?.diagnostics.length" aria-label="Run diagnostics">
      <li v-for="(message, index) in result.diagnostics" :key="index">{{ message }}</li>
    </ul>
    <p v-if="result?.status === 'passed' || result?.status === 'failed'">Current-source educational feedback. This is not an authoritative score.</p>
    <ol v-if="result?.status === 'passed' || result?.status === 'failed'" aria-label="Test case results">
      <li v-for="test in result.cases" :key="test.caseId">
        <strong>{{ test.status === 'passed' ? 'Pass' : 'Fail' }} — {{ label(test.caseId) }}</strong>
        <template v-if="test.status === 'failed'">
          <div>Expected <code>{{ JSON.stringify(test.expected) }}</code></div>
          <div>Actual <code>{{ JSON.stringify(test.actual) }}</code></div>
        </template>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.test-results { display: grid; gap: 8px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-control); }
p, ul, ol { margin: 0; }
#execution-status { font-weight: 700; }
ul, ol { padding-left: 24px; }
li + li { margin-top: 8px; }
li, p, code { overflow-wrap: anywhere; white-space: pre-wrap; }
code { font-size: 12px; }
</style>
