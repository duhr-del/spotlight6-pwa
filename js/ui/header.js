import { h } from './dom.js';

export function modeHeader({ title, subtitle, onBack, right }) {
  return h(
    'header',
    { class: 'topbar topbar--mode' },
    h('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Назад на главный экран',
      onClick: onBack
    }, '←'),
    h('div', { class: 'topbar__text topbar__text--center' },
      subtitle ? h('p', { class: 'topbar__sub' }, subtitle) : null,
      h('h1', { class: 'topbar__title topbar__title--small' }, title)
    ),
    right || h('span', { class: 'icon-btn icon-btn--placeholder', 'aria-hidden': 'true' })
  );
}

export function feedbackBox(feedback) {
  if (!feedback) return null;
  const kind = feedback.kind || 'info';
  const icon = kind === 'ok' ? '✅' : kind === 'err' ? '❌' : 'ℹ️';
  return h(
    'div',
    { class: `feedback feedback--${kind}`, role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'feedback__icon', 'aria-hidden': 'true' }, icon),
    h('div', { class: 'feedback__body' },
      h('p', { class: 'feedback__text' }, feedback.text),
      feedback.hint ? h('p', { class: 'feedback__hint' }, feedback.hint) : null
    )
  );
}