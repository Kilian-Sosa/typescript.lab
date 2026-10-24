<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChallengeSummary, Difficulty } from '../../../shared/contracts/v1';
import { filterChallenges, listChallenges } from './registry';

const props = withDefaults(defineProps<{
  challenges?: readonly ChallengeSummary[];
}>(), {
  challenges: () => listChallenges(),
});

const emit = defineEmits<{
  select: [slug: string];
}>();

const search = ref('');
const difficulty = ref<'all' | Difficulty>('all');

const filteredChallenges = computed(() => {
  const selectedDifficulty = difficulty.value === 'all' ? undefined : difficulty.value;
  return filterChallenges(props.challenges, search.value, selectedDifficulty);
});

const hasCatalog = computed(() => props.challenges.length > 0);
</script>

<template>
  <section id="challenge-list" class="challenge-catalog" aria-labelledby="catalog-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">PUBLIC CATALOG</p>
        <h2 id="catalog-title">Explore challenges</h2>
        <p>Practice stays available whether or not you have an account.</p>
      </div>
    </div>

    <div class="catalog-controls">
      <label class="field-label">
        <span>Search challenges</span>
        <input v-model="search" type="search" autocomplete="off" placeholder="Search by name or topic" />
      </label>
      <label class="field-label" for="challenge-difficulty">
        <span>Difficulty</span>
        <select id="challenge-difficulty" v-model="difficulty" name="difficulty">
          <option value="all">All levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
    </div>

    <div v-if="filteredChallenges.length > 0" class="challenge-list" aria-label="Challenges">
      <RouterLink
        v-for="challenge in filteredChallenges"
        :key="challenge.id"
        class="challenge-row"
        :to="`/challenges/${challenge.slug}`"
        @click="emit('select', challenge.slug)"
      >
        <span class="challenge-mark" aria-hidden="true">&lt;/&gt;</span>
        <span class="challenge-copy">
          <strong>{{ challenge.title }}</strong>
          <span>{{ challenge.objective }}</span>
        </span>
        <span class="difficulty-badge" :class="`difficulty-${challenge.difficulty}`">
          {{ challenge.difficulty }}
        </span>
        <span class="challenge-time">{{ challenge.estimatedMinutes }} min</span>
        <span class="row-chevron" aria-hidden="true">›</span>
      </RouterLink>
    </div>

    <div v-else-if="!hasCatalog" class="empty-state" role="status">
      <span class="empty-state-mark" aria-hidden="true">&lt;/&gt;</span>
      <h3>The first challenges are coming soon</h3>
      <p>The public catalog is being prepared. You can explore it here as soon as challenges are available.</p>
    </div>

    <div v-else class="empty-state" role="status">
      <h3>No challenges match those filters</h3>
      <p>Try a different search or difficulty.</p>
      <button class="text-button" type="button" @click="search = ''; difficulty = 'all'">Clear filters</button>
    </div>
  </section>
</template>
