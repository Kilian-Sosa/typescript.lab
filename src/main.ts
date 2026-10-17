import { createApp } from 'vue';
import App from './app/App.vue';
import { router } from './router';
import { initializeNotebookSession } from './features/solutions/session';
import './app/styles/tokens.css';

const app = createApp(App);
initializeNotebookSession(app);
app.use(router).mount('#app');
