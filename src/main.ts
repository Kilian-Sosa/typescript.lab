import { createApp } from 'vue';
import App from './app/App.vue';
import { initialAuthCallback, router } from './router';
import { initializeNotebookSession } from './features/solutions/session';
import { authCallbackKey } from './features/auth/auth';
import './app/styles/tokens.css';

const app = createApp(App);
app.provide(authCallbackKey, initialAuthCallback);
initializeNotebookSession(app);
app.use(router).mount('#app');
