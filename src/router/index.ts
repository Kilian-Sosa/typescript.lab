import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/explore' },
  {
    path: '/explore',
    name: 'explore',
    component: () => import('../pages/ExplorePage.vue'),
  },
  {
    path: '/challenges/:slug',
    name: 'challenge',
    component: () => import('../pages/ChallengePage.vue'),
  },
  {
    path: '/notebook',
    name: 'notebook',
    component: () => import('../pages/NotebookPage.vue'),
  },
  {
    path: '/notebook/:slug',
    name: 'notebook-detail',
    component: () => import('../pages/NotebookChallengePage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (!to.hash) {
      return { top: 0 };
    }
    try {
      const anchor = document.getElementById(decodeURIComponent(to.hash.slice(1)));
      return anchor ? { el: anchor } : { top: 0 };
    } catch {
      return { top: 0 };
    }
  },
});
