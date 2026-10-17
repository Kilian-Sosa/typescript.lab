<script setup lang="ts">
import { computed } from 'vue';
import type { SolutionAttempt } from '../../../shared/contracts/v1';

const props = defineProps<{
  earlier: SolutionAttempt;
  later: SolutionAttempt;
}>();

type Change = 'unchanged' | 'removed' | 'added';
interface DiffLine {
  readonly lineNumber: number;
  readonly change: Change;
  readonly text: string;
}

function sourceLines(source: string): string[] {
  return source.split(/\r\n|\n/);
}

function buildDiffLines(earlierSource: string, laterSource: string, side: 'earlier' | 'later'): DiffLine[] {
  const earlier = sourceLines(earlierSource);
  const later = sourceLines(laterSource);
  let prefix = 0;
  while (prefix < earlier.length && prefix < later.length && earlier[prefix] === later[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < earlier.length - prefix
    && suffix < later.length - prefix
    && earlier[earlier.length - suffix - 1] === later[later.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const lines = side === 'earlier' ? earlier : later;
  return lines.map((text, index) => ({
    lineNumber: index + 1,
    change: index < prefix || index >= lines.length - suffix
      ? 'unchanged'
      : side === 'earlier' ? 'removed' : 'added',
    text,
  }));
}

const earlierLines = computed(() => buildDiffLines(props.earlier.source, props.later.source, 'earlier'));
const laterLines = computed(() => buildDiffLines(props.earlier.source, props.later.source, 'later'));

function changeLabel(change: Change): string {
  if (change === 'removed') {
    return 'Removed';
  }
  if (change === 'added') {
    return 'Added';
  }
  return 'Unchanged';
}
</script>

<template>
  <section class="comparison" aria-labelledby="comparison-title">
    <h2 id="comparison-title">Source comparison</h2>
    <div class="comparison-panes">
      <section class="comparison-pane" aria-label="Earlier attempt source">
        <h3>Earlier · challenge version {{ earlier.challengeVersion }}</h3>
        <ol class="diff-lines">
          <li v-for="line in earlierLines" :key="line.lineNumber" :data-change="line.change">
            <span class="line-number" aria-hidden="true">{{ line.lineNumber }}</span>
            <span class="change-label">{{ changeLabel(line.change) }}</span>
            <code>{{ line.text || ' ' }}</code>
          </li>
        </ol>
      </section>
      <section class="comparison-pane" aria-label="Later attempt source">
        <h3>Later · challenge version {{ later.challengeVersion }}</h3>
        <ol class="diff-lines">
          <li v-for="line in laterLines" :key="line.lineNumber" :data-change="line.change">
            <span class="line-number" aria-hidden="true">{{ line.lineNumber }}</span>
            <span class="change-label">{{ changeLabel(line.change) }}</span>
            <code>{{ line.text || ' ' }}</code>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>

<style scoped>
.comparison {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.comparison > h2 {
  margin: 0;
  font-size: 16px;
}

.comparison-panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}

.comparison-pane {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}

.comparison-pane h3 {
  margin: 0;
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.diff-lines {
  display: grid;
  gap: 0;
  overflow-x: auto;
  margin: 0;
  padding: 8px 0;
  list-style: none;
  font: 11px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.diff-lines li {
  display: grid;
  grid-template-columns: 2.2em 5.5em minmax(0, 1fr);
  gap: 7px;
  min-width: 0;
  padding: 1px 10px;
}

.line-number {
  color: var(--muted);
  text-align: right;
  user-select: none;
}

.change-label {
  color: var(--text);
  font: 600 10px/1.7 system-ui, sans-serif;
}

.diff-lines code {
  color: var(--text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.diff-lines [data-change="removed"] {
  border-left: 3px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

.diff-lines [data-change="added"] {
  border-left: 3px solid var(--accent-strong);
  background: color-mix(in srgb, var(--accent-strong) 8%, transparent);
}

@media (max-width: 700px) {
  .comparison-panes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
