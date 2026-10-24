<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AuthControls from '../../features/auth/AuthControls.vue';

type Theme = 'light' | 'dark';

const theme = ref<Theme>('light');
const route = useRoute();
const isNotebookSection = computed(() => route.path === '/notebook' || route.path.startsWith('/notebook/'));

function setTheme(nextTheme: Theme): void {
  theme.value = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  window.localStorage.setItem('typescript-lab-theme', nextTheme);
}

function toggleTheme(): void {
  setTheme(theme.value === 'light' ? 'dark' : 'light');
}

onMounted(() => {
  const savedTheme = window.localStorage.getItem('typescript-lab-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : prefersDark ? 'dark' : 'light');
});
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>

    <header class="topbar">
      <RouterLink class="brand" to="/explore" aria-label="typescript.lab home">
        <span class="brand-mark" aria-hidden="true">&lt;/&gt;</span>
        <span>typescript<span class="brand-accent">.lab</span></span>
      </RouterLink>

      <div class="topbar-actions">
        <AuthControls />
        <a
          class="header-action repository-link"
          href="https://github.com/Kilian-Sosa/typescript.lab"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub repository
          <span aria-hidden="true">↗</span>
        </a>
        <button
          class="header-action theme-toggle"
          type="button"
          :aria-label="theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
          @click="toggleTheme"
        >
          <span aria-hidden="true">{{ theme === 'light' ? '◐' : '☼' }}</span>
          <span>{{ theme === 'light' ? 'Dark theme' : 'Light theme' }}</span>
        </button>
      </div>
    </header>

    <div class="app-layout">
      <aside class="sidebar" aria-label="Workspace">
        <p class="sidebar-label">WORKSPACE</p>
        <nav class="primary-navigation" aria-label="Primary navigation">
          <RouterLink class="nav-link" to="/explore" aria-label="Explore challenges">
            <span class="nav-icon" aria-hidden="true">▦</span>
            <span>Explore</span>
          </RouterLink>
          <RouterLink class="nav-link" to="/challenges/longest-window" aria-label="Practice challenges">
            <span class="nav-icon" aria-hidden="true">&lt;/&gt;</span>
            <span>Practice</span>
          </RouterLink>
          <RouterLink
            class="nav-link"
            :class="{ 'router-link-active': isNotebookSection }"
            to="/notebook"
            aria-label="My Notebook"
            :aria-current="isNotebookSection ? 'location' : undefined"
          >
            <span class="nav-icon" aria-hidden="true">▤</span>
            <span>My Notebook</span>
          </RouterLink>
        </nav>
        <div class="sidebar-note">
          <strong>Build your thinking</strong>
          <p>Every solution starts with one thoughtful attempt.</p>
          <span>Personal history is private</span>
        </div>
      </aside>

      <main id="main-content" class="main-content" tabindex="-1">
        <RouterView />
        <footer class="page-footer">
          <span>typescript.lab</span>
          <span aria-hidden="true">·</span>
          <span>Practice TypeScript with intention</span>
        </footer>
      </main>
    </div>

    <nav class="mobile-navigation" aria-label="Primary navigation">
      <RouterLink class="mobile-nav-link" to="/explore" aria-label="Explore challenges">
        <span aria-hidden="true">▦</span><span>Explore</span>
      </RouterLink>
      <RouterLink class="mobile-nav-link" to="/challenges/longest-window" aria-label="Practice challenges">
        <span aria-hidden="true">&lt;/&gt;</span><span>Practice</span>
      </RouterLink>
      <RouterLink
        class="mobile-nav-link"
        :class="{ 'router-link-active': isNotebookSection }"
        to="/notebook"
        aria-label="My Notebook"
        :aria-current="isNotebookSection ? 'location' : undefined"
      >
        <span aria-hidden="true">▤</span><span>Notebook</span>
      </RouterLink>
    </nav>
  </div>
</template>
