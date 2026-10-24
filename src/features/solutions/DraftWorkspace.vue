<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { AttemptEvaluation } from '../../../shared/contracts/v1';
import type { SourceEvaluation } from '../runner/runEvaluation';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { authControllerKey } from '../auth/auth';
import { draftRepositoryKey } from './session';
import { createDraftRecovery, recoveryTabId, previousRecoveryTabId } from './draftRecovery';
import { createDraftSync } from './draftSync';
import DraftSaveStatus from './DraftSaveStatus.vue';
import AttemptSubmissionPanel from './AttemptSubmissionPanel.vue';
import CodeEditor from '../runner/CodeEditor.vue';
import RunnerControls from '../runner/RunnerControls.vue';
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
const workspaceRevision = ref(0);
const evaluated = shallowRef<SourceEvaluation | null>(null);
// Observe the underlying buffer synchronously: edit/revert in one render must still invalidate a pass.
watch(() => [sync.state.source, props.challengeId, props.challengeVersion, auth?.state.userId,
  auth?.state.generation, auth?.state.status, auth?.state.signingOut, auth?.state.signOutFailed], () => {
  workspaceRevision.value++;
  evaluated.value = null;
}, { flush: 'sync' });
const evaluation = computed<AttemptEvaluation>(() => {
  const current = evaluated.value;
  return current && current.workspaceRevision === workspaceRevision.value && current.source === source.value
    && current.challengeId === props.challengeId && current.challengeVersion === props.challengeVersion
    ? current.summary : { status: 'untested' };
});
const noteFields = computed(() => ({ notes: sync.state.notes, timeComplexity: sync.state.timeComplexity, spaceComplexity: sync.state.spaceComplexity }));
watch(() => auth?.state.userId ?? null, (owner) => { void sync.connect(owner); }, { immediate: true, flush: 'sync' });
const offline = () => sync.setOffline();
const online = () => { void sync.retry(); };
const storageChanged = () => sync.refreshRecoveries();
function preventLoss(event: BeforeUnloadEvent) {
  if (sync.state.localError) { event.preventDefault(); event.returnValue = ''; }
}
onBeforeRouteLeave(() => !sync.state.localError || window.confirm('Browser recovery is unavailable. Download or copy your work before leaving. Leave anyway?'));
onMounted(() => {
  window.addEventListener('offline', offline); window.addEventListener('online', online);
  window.addEventListener('storage', storageChanged);
  window.addEventListener('beforeunload', preventLoss);
});
onBeforeUnmount(() => {
  window.removeEventListener('offline', offline); window.removeEventListener('online', online);
  window.removeEventListener('storage', storageChanged);
  window.removeEventListener('beforeunload', preventLoss); sync.dispose();
});
</script>

<template>
  <div class="draft-workspace">
    <CodeEditor v-model="source" />
    <DraftSaveStatus :sync="sync" :challenge-id="challengeId" :challenge-version="challengeVersion" />
    <RunnerControls
      :source="source"
      :challenge-id="challengeId"
      :challenge-version="challengeVersion"
      :reset-key="workspaceRevision"
      @evaluation="evaluated = $event"
    />
    <AttemptSubmissionPanel
      :key="auth?.state.generation ?? 0"
      :challenge-id="challengeId"
      :challenge-version="challengeVersion"
      :source="source"
      :evaluation="evaluation"
      :context-revision="workspaceRevision"
      :recovery-notes="noteFields"
      :return-to="route.fullPath"
      @notes-changed="sync.editNotes"
    />
  </div>
</template>

<style scoped>
.draft-workspace { display: grid; gap: 12px; min-width: 0; }
</style>
