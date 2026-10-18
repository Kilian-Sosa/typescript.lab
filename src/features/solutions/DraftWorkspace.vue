<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { authControllerKey } from '../auth/auth';
import { draftRepositoryKey } from './session';
import { createDraftRecovery, recoveryTabId, previousRecoveryTabId } from './draftRecovery';
import { createDraftSync } from './draftSync';
import DraftSaveStatus from './DraftSaveStatus.vue';
import AttemptSubmissionPanel from './AttemptSubmissionPanel.vue';
const props = defineProps<{ challengeId: string; challengeVersion: string; starter: string }>();
const auth = inject(authControllerKey, null);
const repository = inject(draftRepositoryKey, null);
const route = useRoute();
const fresh = typeof route.query.fresh === 'string' ? route.query.fresh : '';
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
  key: (index: number) => window.localStorage.key(index),
  get length() { return window.localStorage.length; },
};
const tabId = recoveryTabId();
const previousTabId = previousRecoveryTabId();
const pointerKey = (owner: string | null, challenge: string) => `typescript-lab-buffer-pointer-v1:${JSON.stringify([owner, challenge, fresh])}`;
const sync = createDraftSync({ repository, recovery: createDraftRecovery(storage, `${tabId}:${fresh}`,
  (owner, challenge) => sessionStorage.getItem(pointerKey(owner, challenge)) ?? (previousTabId ? `${previousTabId}:${fresh}` : undefined),
  (owner, challenge, tab) => sessionStorage.setItem(pointerKey(owner, challenge), tab)),
  challenge: { id: props.challengeId, version: props.challengeVersion, starter: props.starter }, fresh: !!fresh, isOnline: () => navigator.onLine });
const source = computed({ get: () => sync.state.source, set: (value) => sync.edit(value) });
const noteFields = computed(() => ({ notes: sync.state.notes, timeComplexity: sync.state.timeComplexity, spaceComplexity: sync.state.spaceComplexity }));
watch(() => auth?.state.userId ?? null, (owner) => { void sync.connect(owner); }, { immediate: true, flush: 'sync' });
const offline = () => sync.setOffline();
const online = () => { void sync.retry(); };
function preventLoss(event: BeforeUnloadEvent) {
  if (sync.state.localError) { event.preventDefault(); event.returnValue = ''; }
}
onBeforeRouteLeave(() => !sync.state.localError || window.confirm('Browser recovery is unavailable. Download or copy your work before leaving. Leave anyway?'));
onMounted(() => {
  window.addEventListener('offline', offline); window.addEventListener('online', online);
  window.addEventListener('beforeunload', preventLoss);
});
onBeforeUnmount(() => {
  window.removeEventListener('offline', offline); window.removeEventListener('online', online);
  window.removeEventListener('beforeunload', preventLoss); sync.dispose();
});
</script>

<template>
  <div class="draft-workspace">
    <label class="source-label" for="learner-source">Your TypeScript implementation</label>
    <textarea id="learner-source" v-model="source" aria-label="TypeScript source" aria-describedby="source-persistence execution-status"
      class="source-editor" spellcheck="false" autocapitalize="off" autocomplete="off" />
    <DraftSaveStatus :sync="sync" :challenge-id="challengeId" :challenge-version="challengeVersion" />
    <div class="notice-panel" role="status">
      <h3 id="execution-status">Tests have not run</h3>
      <p>Running learner code is pending the isolated runner's security review.</p>
    </div>
    <AttemptSubmissionPanel :key="auth?.state.generation ?? 0" :challenge-id="challengeId" :challenge-version="challengeVersion"
      :source="source" :recovery-notes="noteFields" :return-to="route.fullPath" @notes-changed="sync.editNotes" />
  </div>
</template>

<style scoped>
.draft-workspace { display: grid; gap: 12px; min-width: 0; }
.source-label { font-weight: 650; }
.source-editor { box-sizing: border-box; width: 100%; min-height: 290px; padding: 16px; resize: vertical; border: 1px solid var(--border);
  border-radius: 10px; background: var(--editor); color: #edf0fa; font: 13px/1.65 var(--font-mono, monospace); tab-size: 2; }
.notice-panel h3 { margin: 0; font-size: 14px; }
.notice-panel p { margin: 5px 0 0; color: var(--muted); font-size: 12px; }
</style>
