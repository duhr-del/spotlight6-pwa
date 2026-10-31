import { h, toast } from './dom.js';
import { modeHeader } from './header.js';
import { speak, isSupported as ttsSupported, listVoices } from '../tts.js';
import { isSupported as sttSupported } from '../speech.js';
import { setSetting, resetAll, isAvailable as storageAvailable } from '../storage.js';

function segmented(name, value, options, onChange) {
  return h(
    'div',
    { class: 'segmented', role: 'group' },
    ...options.map((option) => h(
      'button',
      {
        class: `segmented__item${option.value === value ? ' is-active' : ''}`,
        type: 'button',
        'aria-pressed': option.value === value ? 'true' : 'false',
        onClick: () => onChange(name, option.value)
      },
      option.label
    ))
  );
}

export function renderSettings(ctx) {
  const settings = ctx.settings;
  let confirmingReset = false;

  const root = h('div', { class: 'screen screen--settings' });

  function update(name, value) {
    setSetting(name, value);
    ctx.rerender();
  }

  function testVoice() {
    if (!ttsSupported()) {
      toast('Синтез речи в этом браузере недоступен', 'err');
      return;
    }
    const voices = listVoices().filter((voice) => /^en/i.test(voice.lang));
    if (!voices.length) toast('Английский голос ещё не загрузился, попробуй через секунду', 'info');
    speak('Hello! This is a reading sample.', { accent: settings.accent, rate: settings.rate });
  }

  function render() {
    root.replaceChildren(
      modeHeader({ title: 'Настройки', subtitle: 'Приложение', onBack: () => ctx.go('home') }),

      h('section', { class: 'panel' },
        h('h2', { class: 'panel__title' }, 'Озвучка'),
        h('p', { class: 'panel__label' }, 'Акцент'),
        segmented('accent', settings.accent, [
          { value: 'en-GB', label: 'Британский' },
          { value: 'en-US', label: 'Американский' }
        ], update),
        h('p', { class: 'panel__label' }, 'Скорость речи'),
        segmented('rate', settings.rate, [
          { value: 0.8, label: 'Медленно' },
          { value: 0.9, label: 'Обычно' },
          { value: 1, label: 'Быстро' }
        ], update),
        h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onClick: testVoice }, '🔊 Проверить голос')
      ),

      h('section', { class: 'panel' },
        h('h2', { class: 'panel__title' }, 'Проверка чтения'),
        h('p', { class: 'panel__label' }, 'Насколько строго сравнивать'),
        segmented('readingMode', settings.readingMode, [
          { value: 'easy', label: 'Свободный порядок' },
          { value: 'strict', label: 'Строгий порядок' }
        ], update),
        h('p', { class: 'panel__hint' },
          settings.readingMode === 'strict'
            ? 'Слова должны идти в том же порядке, что и в образце. Пропущенное слово снижает процент.'
            : 'Считается, сколько слов из фразы расслышал микрофон. Порядок не важен — так спокойнее для ребёнка.'
        )
      ),

      h('section', { class: 'panel' },
        h('h2', { class: 'panel__title' }, 'Что поддерживает браузер'),
        h('ul', { class: 'check-list' },
          h('li', null, `${ttsSupported() ? '✅' : '❌'} Синтез речи (озвучка слов и фраз)`),
          h('li', null, `${sttSupported() ? '✅' : '❌'} Распознавание речи (микрофон)`),
          h('li', null, `${storageAvailable() ? '✅' : '❌'} Сохранение прогресса в этом браузере`),
          h('li', null, `${navigator.onLine ? '✅' : '⚠️'} Сеть: распознаванию речи нужен интернет`)
        ),
        h('p', { class: 'panel__hint' },
          'Распознавание речи работает в Chrome и Edge на Android и Windows. В Safari и Firefox кнопка микрофона может быть недоступна.'
        )
      ),

      h('section', { class: 'panel panel--danger' },
        h('h2', { class: 'panel__title' }, 'Прогресс'),
        h('p', { class: 'panel__hint' }, 'Звёзды и освоенные слова хранятся только на этом устройстве. Сброс нельзя отменить.'),
        confirmingReset
          ? h('div', { class: 'actions actions--row' },
            h('button', {
              class: 'btn btn--danger',
              type: 'button',
              onClick: () => {
                resetAll();
                confirmingReset = false;
                toast('Прогресс сброшен', 'info');
                ctx.rerender();
              }
            }, 'Да, стереть всё'),
            h('button', {
              class: 'btn btn--ghost',
              type: 'button',
              onClick: () => { confirmingReset = false; render(); }
            }, 'Отмена')
          )
          : h('button', {
            class: 'btn btn--ghost btn--wide',
            type: 'button',
            onClick: () => { confirmingReset = true; render(); }
          }, 'Сбросить прогресс')
      ),

      h('p', { class: 'footnote' },
        'Английский в фокусе 6 · тренажёр для личного использования. Контент лежит в папке data — его можно править без изменения кода.'
      )
    );
  }

  render();
  return root;
}