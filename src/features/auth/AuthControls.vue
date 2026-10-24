<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useRoute } from 'vue-router';
import { authControllerKey } from './auth';
const auth = inject(authControllerKey, null);
const route = useRoute();
const error = ref('');
const signingIn = ref(false);
const returnTo = computed(() => route.path.startsWith('/challenges/') || route.path.startsWith('/notebook')
  ? route.path + (typeof route.query.fresh === 'string' ? `?fresh=${encodeURIComponent(route.query.fresh)}` : '') : '/notebook');
async function signIn() {
  if (signingIn.value) return;
  signingIn.value = true;
  try { error.value = ''; await auth?.signIn(returnTo.value); }
  catch { error.value = 'Sign-in could not start. Your local work is retained; please retry.'; }
  finally { signingIn.value = false; }
}
</script>

<template>
  <div v-if="auth && route.matched.length" class="account-controls" aria-label="Private account">
    <span v-if="auth.state.status === 'checking'" class="account-checking" role="status">Checking account…</span>
    <button
      v-else-if="auth.state.userId || auth.state.signingOut"
      type="button"
      class="header-action"
      :disabled="auth.state.signingOut"
      :aria-busy="auth.state.signingOut"
      @click="auth.signOut"
    >
      Sign out
    </button>
    <button v-else-if="auth.state.signOutFailed" type="button" class="header-action" @click="auth.signOut">
      Retry sign-out
    </button>
    <template v-else>
      <button type="button" class="header-action" :disabled="signingIn" :aria-busy="signingIn" @click="signIn">
        Sign in with GitHub
      </button>
      <button v-if="auth.state.status === 'error'" type="button" class="header-action" @click="auth.start">
        Retry session
      </button>
    </template>
    <p v-if="error || auth.state.message" class="account-message" role="status">{{ error || auth.state.message }}</p>
  </div>
</template>

<style scoped>
.account-controls { display: grid; flex: 0 0 160px; width: 160px; max-width: 100%; gap: 8px; font-size: 12px; }
.account-checking { display: flex; min-height: 40px; align-items: center; justify-content: center; }
.account-message { min-width: 0; margin: 0; overflow-wrap: anywhere; }
</style>
