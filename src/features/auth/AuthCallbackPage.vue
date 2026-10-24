<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { authCallbackKey, authControllerKey } from './auth';

const auth = inject(authControllerKey, null);
const callback = inject(authCallbackKey, null);
const router = useRouter();
const checking = ref(true);
const retryError = ref('');
onMounted(async () => {
  const path = await auth?.completeCallback(callback);
  checking.value = false;
  if (path) await router.replace(path);
});
async function retry() {
  try { await auth?.signIn(); }
  catch { retryError.value = 'Sign-in could not start. Check your connection and try again.'; }
}
</script>

<template>
  <section class="page-section" aria-labelledby="callback-title">
    <p class="eyebrow">PRIVATE ACCOUNT</p>
    <h1 id="callback-title">GitHub sign-in</h1>
    <p v-if="checking" role="status">Verifying your sign-in…</p>
    <div v-else class="notice-panel" role="alert">
      <p>
        {{ retryError || auth?.state.message || 'Sign-in could not be verified. Restart sign-in; your local work is retained.' }}
      </p>
      <button v-if="auth" type="button" class="primary-button" @click="retry">Restart GitHub sign-in</button>
      <p><RouterLink :to="auth?.state.returnTo ?? '/explore'">Return to your work as a guest</RouterLink></p>
    </div>
  </section>
</template>
