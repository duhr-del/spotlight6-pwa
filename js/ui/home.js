import { h, progressBar, plural } from './dom.js';
import { sectionStats } from '../storage.js';

const MODES = [
  {
    id: 'cards',
    icon: '🗂️',
    title: 'Словарные карточки',
    desc: 'Слушай слово, пиши его и произноси',
    meta: (stats) => `${stats.mastered} из ${stats.wordsTotal} ${plural(stats.wordsTotal, 'слова', 'слов', 'слов')}`,
    ratio: (stats) => (stats.wordsTotal ? (stats.mastered / stats.wordsTotal) * 100 : 0)
  },
  {
    id: 'builder',
    icon: '🧩',
    title: 'Собери предложение',
    desc: 'Расставь слова в правильном порядке',
    meta: (stats) => `${stats.builderDone} из ${stats.builderMax / 2} ${plural(stats.builderMax / 2, 'фразы', 'фраз', 'фраз')}`,
    ratio: (stats) => (stats.builderMax ? (stats.builderStars / stats.builderMax) * 100 : 0)
  },
  {
    id: 'reading',
    icon: '🎧',
    title: 'Проверка чтения',
    desc: 'Прочитай вслух и узнай, что услышал микрофон',
    meta: (stats) => `${stats.readingDone} из ${stats.readingMax / 3} ${plural(stats.readingMax / 3, 'текста', 'текстов', 'текстов')}`,
    ratio: (stats) => (stats.readingMax ? (stats.readingStars / stats.readingMax) * 100 : 0)
  }
];

export function renderHome(ctx) {
  const course = ctx.stats;
  const module = ctx.module;
  const section = ctx.section;
  const moduleIndex = ctx.modules.findIndex((item) => item.id === module.id);
  const moduleStatsData = course.perModule.get(module.id);
  const sectionStatsData = sectionStats(module, section);
  const wordsPercent = course.words ? (course.mastered / course.words) * 100 : 0;

  const progressPanel = h(
    'section',
    { class: 'panel panel--progress' },
    h('div', { class: 'progress__head' },
      h('span', { class: 'progress__label' }, 'Освоено слов'),
      h('strong', { class: 'progress__value' }, `${course.mastered} из ${course.words}`)
    ),
    progressBar(wordsPercent),
    h('div', { class: 'progress__meta' },
      h('span', { class: 'stars-inline' }, `⭐ ${course.stars} из ${course.maxStars}`),
      h('span', { class: 'muted' }, `Всего ${ctx.modules.length} модулей`)
    )
  );

  // Пилюли модулей (1–10)
  const moduleList = h(
    'div',
    { class: 'module-list', role: 'list' },
    ...ctx.modules.map((item, index) => {
      const itemStats = course.perModule.get(item.id);
      const done = itemStats.wordsTotal ? (itemStats.mastered / itemStats.wordsTotal) * 100 : 0;
      const active = item.id === module.id;
      return h(
        'button',
        {
          class: `module-pill${active ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': active ? 'true' : 'false',
          style: { '--accent': item.color },
          onClick: () => ctx.selectModule(item.id)
        },
        h('span', { class: 'module-pill__num' }, String(index + 1)),
        h('span', { class: 'module-pill__body' },
          h('span', { class: 'module-pill__title' }, item.shortTitle.replace(/^Модуль\s*\d+\.\s*/, '')),
          h('span', { class: 'module-pill__meta' }, `${itemStats.mastered} / ${itemStats.wordsTotal}`)
        ),
        h('span', { class: 'module-pill__progress' }, h('span', { style: { width: `${Math.round(done)}%` } }))
      );
    })
  );

  // Пилюли секций (1a, 1b, 1c, 1d) внутри выбранного модуля
  const sectionList = h(
    'div',
    { class: 'module-list module-list--sections', role: 'list' },
    ...module.sections.map((sec) => {
      const secStats = sectionStats(module, sec);
      const done = secStats.wordsTotal ? (secStats.mastered / secStats.wordsTotal) * 100 : 0;
      const active = sec.id === section.id;
      return h(
        'button',
        {
          class: `module-pill module-pill--section${active ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': active ? 'true' : 'false',
          style: { '--accent': module.color },
          onClick: () => ctx.selectSection(sec.id)
        },
        h('span', { class: 'module-pill__num' }, sec.id),
        h('span', { class: 'module-pill__body' },
          h('span', { class: 'module-pill__title' }, sec.title.replace(/^\d+[a-z]\.\s*/, '')),
          h('span', { class: 'module-pill__meta' }, `${secStats.mastered} / ${secStats.wordsTotal}`)
        ),
        h('span', { class: 'module-pill__progress' }, h('span', { style: { width: `${Math.round(done)}%` } }))
      );
    })
  );

  const modeCards = h(
    'div',
    { class: 'mode-grid' },
    ...MODES.map((mode) => h(
      'button',
      {
        class: 'mode-card',
        type: 'button',
        style: { '--accent': module.color },
        onClick: () => ctx.go(mode.id)
      },
      h('span', { class: 'mode-card__icon', 'aria-hidden': 'true' }, mode.icon),
      h('span', { class: 'mode-card__title' }, mode.title),
      h('span', { class: 'mode-card__desc' }, mode.desc),
      h('span', { class: 'mode-card__meta' }, mode.meta(sectionStatsData)),
      h('span', { class: 'mode-card__bar' }, h('span', { style: { width: `${Math.round(mode.ratio(sectionStatsData))}%` } }))
    ))
  );

  const installBlock = ctx.installAvailable
    ? h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onClick: () => ctx.install() }, '📲 Установить приложение на устройство')
    : null;

  return h(
    'main',
    { class: 'screen screen--home' },
    h('header', { class: 'topbar' },
      h('div', { class: 'topbar__text' },
        h('h1', { class: 'topbar__title' }, 'Английский в фокусе 6'),
        h('p', { class: 'topbar__sub' }, 'Spotlight 6 · игровой тренажёр')
      ),
      h('button', {
        class: 'icon-btn',
        type: 'button',
        'aria-label': 'Настройки',
        onClick: () => ctx.go('settings')
      }, '⚙️')
    ),
    progressPanel,
    h('section', { class: 'section' },
      h('div', { class: 'section__head' },
        h('h2', { class: 'section__title' }, 'Модуль'),
        h('span', { class: 'muted' }, `${moduleIndex + 1} из ${ctx.modules.length}`)
      ),
      moduleList
    ),
    h('section', { class: 'section' },
      h('div', { class: 'section__head' },
        h('h2', { class: 'section__title' }, 'Подмодуль'),
        h('span', { class: 'muted' }, `${module.sections.length} секции`)
      ),
      sectionList
    ),
    h('section', { class: 'section' },
      h('div', { class: 'section__head' },
        h('h2', { class: 'section__title' }, section.title),
        h('span', { class: 'stars-inline' }, `⭐ ${sectionStatsData.stars} из ${sectionStatsData.maxStars}`)
      ),
      modeCards
    ),
    installBlock,
    h('p', { class: 'footnote' },
      'Без интернета работают карточки, конструктор и озвучка. Проверка произношения использует сервис распознавания речи и требует сети.'
    )
  );
}
