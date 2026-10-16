<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { findChallenge } from '../features/challenges/registry';

const route = useRoute();
const challenge = computed(() => findChallenge(String(route.params.slug ?? '')));
</script>

<template>
  <section class="page-section" aria-labelledby="challenge-title">
    <p class="eyebrow">CHALLENGE</p>
    <template v-if="challenge">
      <h1 id="challenge-title">{{ challenge.title }}</h1>
      <p class="challenge-objective">{{ challenge.objective }}</p>
      <div class="challenge-meta">
        <span class="difficulty-badge" :class="`difficulty-${challenge.difficulty}`">{{ challenge.difficulty }}</span>
        <span>{{ challenge.estimatedMinutes }} min</span>
      </div>
      <div class="notice-panel" role="status">
        <h2>Practice workspace is not connected yet</h2>
        <p>This challenge is listed, but code execution and saving are not available in this foundation.</p>
      </div>
    </template>
    <template v-else>
      <h1 id="challenge-title">Challenge not found</h1>
      <div class="notice-panel notice-error" role="alert">
        <p>This challenge is not available in this catalog.</p>
        <p>The public catalog may still be empty, or the link may be incorrect.</p>
      </div>
      <RouterLink class="primary-button" to="/explore">Explore challenges</RouterLink>
    </template>
  </section>
</template>
