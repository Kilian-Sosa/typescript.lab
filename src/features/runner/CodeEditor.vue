<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="code-editor">
    <label class="source-label" for="learner-source">Your TypeScript implementation</label>
    <p id="source-help">Use Tab to move to the next control. Run tests checks this exact buffer.</p>
    <textarea id="learner-source" :value="modelValue" aria-label="TypeScript source"
      aria-describedby="source-help source-persistence execution-status" class="source-editor"
      spellcheck="false" autocapitalize="off" autocomplete="off"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
  </div>
</template>

<style scoped>
.code-editor { display: grid; gap: 8px; min-width: 0; }
.source-label { font-weight: 650; }
p { margin: 0; color: var(--muted); font-size: 12px; }
.source-editor { box-sizing: border-box; width: 100%; min-height: 290px; padding: 16px; resize: vertical;
  border: 1px solid var(--border); border-radius: 10px; background: var(--editor); color: #edf0fa;
  font: 13px/1.65 var(--font-mono, monospace); tab-size: 2; }
</style>
