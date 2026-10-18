<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useRoute } from 'vue-router';
import { authControllerKey } from './auth';
const auth = inject(authControllerKey, null);
const route = useRoute();
const error = ref('');
const returnTo = computed(() => route.path.startsWith('/challenges/') || route.path.startsWith('/notebook')
  ? route.path + (typeof route.query.fresh === 'string' ? `?fresh=${encodeURIComponent(route.query.fresh)}` : '') : '/notebook');
async function signIn() {
  try { error.value = ''; await auth?.signIn(returnTo.value); }
  catch { error.value = 'Sign-in could not start. Your local work is retained; please retry.'; }
}
</script>

<template>
  <div v-if="auth && route.matched.length" class="account-controls" aria-label="Private account">
    <span v-if="auth.state.status === 'checking'" role="status">Checking account…</span>
    <template v-else-if="auth.state.userId">
      <span>Private account connected</span>
      <button type="button" class="text-button" :disabled="auth.state.signingOut" @click="auth.signOut">Sign out</button>
    </template>
    <button v-else-if="auth.state.signOutFailed" type="button" class="text-button" @click="auth.signOut">Retry sign-out</button>
    <template v-else>
      <button type="button" class="text-button" @click="signIn">Sign in with GitHub</button>
      <button v-if="auth.state.status === 'error'" type="button" class="text-button" @click="auth.start">Retry session</button>
    </template>
    <p v-if="error || auth.state.message" class="account-message" role="status">{{ error || auth.state.message }}</p>
  </div>
</template>

<style scoped>
.account-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.account-message { flex-basis: 100%; margin: 0; max-width: 420px; overflow-wrap: anywhere; }
button { min-height: 40px; }
</style>
