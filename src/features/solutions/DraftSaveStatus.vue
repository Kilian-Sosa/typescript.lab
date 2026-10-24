<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DraftSync } from './draftSync';
const props = defineProps<{ sync: DraftSync; challengeId: string; challengeVersion: string }>();
const state = computed(() => props.sync.state);
const guest = computed(() => state.value.guestAvailable ? props.sync.guestBuffer() : null);
const downloadError = ref('');
const status = computed(() => ({
  loading: 'Loading your private draft. New edits stay here while it loads.',
  idle: 'Edits are waiting to save privately.',
  guest: state.value.localError
    ? 'Guest draft: kept in memory in this page. Browser recovery is unavailable; download or copy your work before leaving.'
    : 'Guest draft: stored on this browser only. Sign in and explicitly import it to save privately.',
  saving: 'Saving privately… Your local recovery buffer is retained.',
  saved: 'Saved privately. The server confirmed this source.',
  offline: 'Offline. Your local work is retained; reconnect or retry to save privately.',
  error: 'Could not save or load the private draft. Your local work is retained. Retry when connected.',
  conflict: 'Draft conflict. Your text is retained. Review the cloud version before choosing.',
  'auth-required': 'Your session changed or expired. Sign in to the same account to recover and retry.',
})[state.value.status]);
function download() {
  try {
    const content = { challengeId: props.challengeId, challengeVersion: props.challengeVersion, exportedAt: new Date().toISOString(), source: state.value.source,
      notes: state.value.notes, timeComplexity: state.value.timeComplexity, spaceComplexity: state.value.spaceComplexity };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'typescript-lab-local-draft.json'; anchor.click();
    URL.revokeObjectURL(url);
  } catch { downloadError.value = 'The draft could not be downloaded. Your text is still in the editor.'; }
}
</script>

<template>
  <section class="draft-feedback" aria-label="Draft persistence">
    <p id="source-persistence" role="status">{{ status }}</p>
    <p v-if="state.localError" role="alert">Browser recovery storage is unavailable or full. Keep this page open and download or copy your work before leaving.</p>
    <div class="draft-actions">
      <button v-if="['error', 'offline', 'auth-required'].includes(state.status)" type="button" class="text-button" @click="sync.retry">Retry draft save</button>
      <button type="button" class="text-button" aria-label="Download current draft" @click="download">Download current draft</button>
    </div>
    <p v-if="downloadError" role="alert">{{ downloadError }}</p>
    <div v-if="state.status === 'conflict'" class="draft-review" role="alert">
      <h3>Review the cloud draft</h3>
      <p>The editor above contains your local text. Choosing a version is explicit; another tab can still cause a new revision conflict.</p>
      <template v-if="state.remoteDraft">
        <p>Cloud revision {{ state.remoteDraft.revision }} · Challenge version {{ state.remoteDraft.challengeVersion }}</p>
        <pre aria-label="Conflicting cloud draft">{{ state.remoteDraft.source }}</pre>
      </template>
      <p v-else>No cloud draft currently exists.</p>
      <div class="draft-actions">
        <button type="button" class="text-button" @click="sync.resolveConflict('local')">Keep local version and retry</button>
        <button type="button" class="text-button" @click="sync.resolveConflict('remote')">Use cloud version</button>
      </div>
    </div>
    <details v-if="guest && state.status !== 'conflict' && state.status !== 'loading'" class="draft-review">
      <summary>Review guest draft for import</summary>
      <p>This imports a browser-only guest buffer into the connected account. Review both versions before replacing the current draft.</p>
      <pre aria-label="Guest draft to import">{{ guest.source }}</pre>
      <p v-if="guest.notes">Guest notes: {{ guest.notes }}</p>
      <p>Current account draft:</p>
      <pre aria-label="Current account draft before import">{{ state.source }}</pre>
      <button type="button" class="text-button" @click="sync.importGuest">Import guest draft into this account</button>
    </details>
    <details v-if="state.otherRecoveries.length" class="draft-review">
      <summary>Recover another local buffer ({{ state.otherRecoveries.length }})</summary>
      <p>Each entry is distinct local content from another or interrupted tab. Recovering it opens it for review and preserves your current work.</p>
      <button v-for="buffer in state.otherRecoveries" :key="buffer.tabId" type="button" class="text-button" :disabled="buffer.current" @click="sync.recoverBuffer(buffer.tabId)">
        {{ buffer.current ? 'Currently open' : 'Review buffer' }} from {{ new Date(buffer.updatedAt).toLocaleString() }}
      </button>
    </details>
    <p v-if="state.notes || state.timeComplexity || state.spaceComplexity">Notes and declared complexity are {{ state.localError ? 'kept in this page; browser recovery is unavailable' : 'retained on this browser' }}. Save an attempt to store them privately in your immutable history.</p>
  </section>
</template>

<style scoped>
.draft-feedback { display: grid; gap: 10px; font-size: 12px; color: var(--muted); min-width: 0; }
p { margin: 0; overflow-wrap: anywhere; }
.draft-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.draft-review { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-control); }
summary { cursor: pointer; min-height: 32px; font-weight: 650; }
h3 { margin: 0; color: var(--text); font-size: 14px; }
pre { max-height: 260px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text); }
button { min-height: 40px; }
</style>
