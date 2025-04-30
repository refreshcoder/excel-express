import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Message } from '@arco-design/web-vue';
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())

Message._context = app._context;

app.mount('#app')
