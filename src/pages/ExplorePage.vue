<script setup lang="ts">
import ChallengeList from '../features/challenges/ChallengeList.vue';
import { listChallenges } from '../features/challenges/registry';
</script>

<template>
  <section class="page-section" aria-labelledby="explore-title">
    <header class="page-heading">
      <p class="eyebrow">YOUR LEARNING WORKSPACE</p>
      <h1 id="explore-title">Make space for better thinking<span class="accent-period">.</span></h1>
      <p>Work through TypeScript challenges at your own pace. The public catalog is independent of sign-in.</p>
    </header>

    <section class="welcome-panel" aria-labelledby="welcome-title">
      <div>
        <p class="eyebrow">START WHERE YOU ARE</p>
        <h2 id="welcome-title">Small steps.<br /><span>Sharper thinking.</span></h2>
        <p v-if="listChallenges().length === 0">
          The first challenges are being prepared. Browse the catalog below when it opens, or come back later.
        </p>
        <p v-else>Pick a challenge and build your approach one step at a time.</p>
        <a class="primary-button" href="#challenge-list">Browse the catalog <span aria-hidden="true">↓</span></a>
      </div>
      <div class="welcome-art" aria-hidden="true">
        <span class="code-line"><b>const</b> practice = &#123;</span>
        <span class="code-line">&nbsp;&nbsp;curiosity: <i>true</i>,</span>
        <span class="code-line">&nbsp;&nbsp;focus: <i>on understanding</i></span>
        <span class="code-line">&#125;</span>
      </div>
    </section>

    <ChallengeList />
  </section>
</template>
