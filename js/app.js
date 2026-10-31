import { loadData } from './data.js';
import * as storage from './storage.js';
import { loadVoices } from './tts.js';
import { h } from './ui/dom.js';
import { renderHome } from './ui/home.js';
import { renderSettings } from './ui/settings.js';
import { mountFlashcards } from './modes/flashcards.js';
import { mountBuilder } from './modes/builder.js';
import { mountReading } from './modes/reading.js';

const root = document.getElementById('app');

let data = null;
let installPrompt = null;

function currentRoute() {
  const raw = (window.location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  return { name: parts[0] || 'home', parts };
}

function buildContext() {
  return {
    modules: data.modules,
    byId: data.byId,
    get module() {
      const id = storage.get().currentModule;
      return data.byId.get(id) || data.modules[0];
    },
    get section() {
      const mod = this.module;
      const sectionId = storage.get().currentSection;
      return mod.sections.find((s) => s.id === sectionId) || mod.sections[0];
    },
    get stats() {
      return storage.courseStats(data.modules);
    },
    get settings() {
      return storage.get().settings;
    },
    go(route) {
      const next = route.startsWith('#') ? route : `#/${route}`;
      if (window.location.hash === next) render();
      else window.location.hash = next;
    },
    selectModule(id) {
      storage.setCurrentModule(id);
      render();
    },
    selectSection(sectionId) {
      storage.setCurrentSection(sectionId);
      render();
    },
    rerender: render,
    get installAvailable() {
      return Boolean(installPrompt);
    },
    async install() {
      if (!installPrompt) return false;
      const prompt = installPrompt;
      installPrompt = null;
      prompt.prompt();
      const choice = await prompt.userChoice;
      return choice.outcome === 'accepted';
    }
  };
}

function render() {
  if (!data) return;
  const route = currentRoute();
  const ctx = buildContext();
  let node = null;

  try {
    switch (route.name) {
      case 'cards':
        node = mountFlashcards(ctx);
        break;
      case 'builder':
        node = mountBuilder(ctx);
        break;
      case 'reading':
        node = mountReading(ctx);
        break;
      case 'settings':
        node = renderSettings(ctx);
        break;
      case 'home':
        node = renderHome(ctx);
        break;
      default:
        node = renderHome(ctx);
    }
  } catch (error) {
    // Error boundary: если конкретный экран упал, не роняем всё приложение —
    // показываем понятное сообщение и кнопку возврата на главную.
    console.error('Ошибка отрисовки экрана', route.name, error);
    node = h('main', { class: 'screen screen--fatal' },
      h('h1', { class: 'fatal-title' }, 'Что-то пошло не так на этом экране'),
      h('p', null, 'Перейди обратно на главный экран и попробуй другой модуль или режим.'),
      h('p', { class: 'muted' }, `Экран: ${route.name}. Деталь: ${error && error.message ? error.message : error}`),
      h('div', { class: 'actions actions--row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { ctx.go('home'); } }, 'На главный экран')
      )
    );
  }

  root.replaceChildren(node);
  document.body.dataset.route = route.name;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderFatal(error) {
  console.error(error);
  root.replaceChildren(
    h('main', { class: 'screen screen--fatal' },
      h('h1', { class: 'fatal-title' }, 'Не удалось загрузить приложение'),
      h('p', null, 'Скорее всего, страница открыта двойным щелчком по файлу. Так браузер блокирует загрузку данных и Service Worker.'),
      h('p', null, 'Запусти локальный сервер в папке проекта и открой адрес из консоли:'),
      h('pre', { class: 'code-block' }, 'python -m http.server 5173\n# затем http://localhost:5173'),
      h('p', { class: 'muted' }, `Техническая деталь: ${error && error.message ? error.message : error}`)
    )
  );
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  const start = () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service Worker не зарегистрирован:', error);
    });
  };
  // boot() асинхронный: событие load может пройти раньше, чем мы сюда доберёмся.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (currentRoute().name === 'home') render();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (currentRoute().name === 'home') render();
  });
}

function watchNetwork() {
  window.addEventListener('online', () => { document.documentElement.classList.remove('is-offline'); });
  window.addEventListener('offline', () => { document.documentElement.classList.add('is-offline'); });
  if (!navigator.onLine) document.documentElement.classList.add('is-offline');
}

async function boot() {
  storage.init();
  watchNetwork();
  watchInstallPrompt();
  window.addEventListener('hashchange', render);

  try {
    data = await loadData();
  } catch (error) {
    renderFatal(error);
    return;
  }

  // Если сохранённый модуль исчез из контента — откатываемся на первый.
  if (!data.byId.has(storage.get().currentModule)) {
    storage.setCurrentModule(data.modules[0].id);
  }
  // Если сохранённая секция не найдена в модуле — сбрасываем на первую.
  const savedMod = data.byId.get(storage.get().currentModule);
  const savedSection = storage.get().currentSection;
  if (savedMod && savedSection && !savedMod.sections.some((s) => s.id === savedSection)) {
    storage.setCurrentSection(null);
  }

  render();
  registerServiceWorker();
  loadVoices();
}

boot();