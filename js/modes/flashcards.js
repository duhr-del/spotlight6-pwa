import { h, nodes } from '../ui/dom.js';
import { modeHeader, feedbackBox } from '../ui/header.js';
import { speak, stop as stopSpeech, isSupported as ttsSupported } from '../tts.js';
import { listen, isSupported as sttSupported, describeError, isOnline } from '../speech.js';
import { wordFlags, markWord } from '../storage.js';
import { spellingOk, spokenMatches } from '../match.js';

export function mountFlashcards(ctx) {
  const mod = ctx.module;
  const section = ctx.section;
  const words = section.words;

  let index = 0;
  let panel = null;       // null | 'spell' | 'speak'
  let feedback = null;
  let pulse = null;       // 'ok' | 'err'
  let draft = '';
  let listening = false;
  let speaking = false;   // TTS сейчас звучит
  let inputEl = null;

  const root = h('div', { class: 'screen screen--mode' });

  function goHome() {
    stopSpeech();
    speaking = false;
    ctx.go('home');
  }

  function playWord(word) {
    if (!ttsSupported()) {
      feedback = { kind: 'info', text: 'В этом браузере нет синтеза речи. Попробуй Chrome или Edge.' };
      render();
      return;
    }
    speaking = true;
    render();
    speak(word.en, { accent: ctx.settings.accent, rate: ctx.settings.rate })
      .finally(() => {
        speaking = false;
        if (root.isConnected) render();
      });
  }

  function openSpell() {
    panel = 'spell';
    feedback = null;
    draft = '';
    pulse = null;
    render();
    // Автоматически произносим слово — жест клика разрешает speechSynthesis.
    // Написание и транскрипция скрыты в render(), ребёнок пишет по слуху.
    playWord(words[index]);
    if (inputEl) inputEl.focus();
  }

  function closePanel() {
    panel = null;
    feedback = null;
    pulse = null;
    speaking = false;
    stopSpeech();
    render();
  }

  function move(delta) {
    index = (index + delta + words.length) % words.length;
    panel = null;
    feedback = null;
    pulse = null;
    speaking = false;
    draft = '';
    stopSpeech();
    render();
  }

  function submitSpelling() {
    const word = words[index];
    const value = inputEl ? inputEl.value : draft;

    if (!value || !value.trim()) {
      feedback = { kind: 'info', text: 'Сначала введи слово по-английски. Можно нажать «Повторить», чтобы послушать ещё раз.' };
      render();
      if (inputEl) inputEl.focus();
      return;
    }

    if (spellingOk(value, word.en)) {
      const isNew = markWord(mod.id, word.en, 'spell');
      feedback = {
        kind: 'ok',
        text: isNew ? `Правильно! +1 ⭐ — ${word.en}` : `Правильно! ${word.en} уже было отмечено.`,
        hint: word.transcription ? `Транскрипция: ${word.transcription}` : null
      };
      panel = null;
      pulse = 'ok';
      draft = '';
      render();
      return;
    }

    feedback = {
      kind: 'err',
      text: 'Пока не совпало. Послушай ещё раз и попробуй.',
      hint: word.transcription ? `Подсказка: ${word.transcription}` : null
    };
    pulse = 'err';
    draft = value;
    render();
    if (inputEl) {
      inputEl.classList.add('has-error');
      inputEl.focus();
      const end = inputEl.value.length;
      inputEl.setSelectionRange(end, end);
    }
  }

  async function startSpeaking() {
    if (listening) return;
    const word = words[index];

    if (!sttSupported()) {
      panel = 'speak';
      feedback = { kind: 'err', text: describeError('unsupported') };
      render();
      return;
    }

    if (!isOnline()) {
      panel = 'speak';
      feedback = {
        kind: 'info',
        text: 'Проверка произношения работает через сервис распознавания речи, ему нужен интернет.',
        hint: 'Карточки, конструктор и озвучка работают офлайн.'
      };
      render();
      return;
    }

    stopSpeech();
    speaking = false;
    listening = true;
    panel = 'speak';
    pulse = null;
    feedback = { kind: 'info', text: 'Слушаю… Скажи слово по-английски.' };
    render();

    const result = await listen({ accent: ctx.settings.accent });
    if (!root.isConnected) return;

    listening = false;

    if (!result.ok) {
      feedback = { kind: 'err', text: describeError(result.error) };
      render();
      return;
    }

    if (spokenMatches(result.transcripts, word.en)) {
      const isNew = markWord(mod.id, word.en, 'speak');
      feedback = {
        kind: 'ok',
        text: isNew ? 'Отлично! +1 ⭐' : 'Отлично! Это слово уже было отмечено.',
        hint: `Я услышал: «${result.transcripts[0]}»`
      };
      panel = null;
      pulse = 'ok';
    } else {
      feedback = {
        kind: 'err',
        text: 'Попробуй ещё раз — я услышал другое слово.',
        hint: `Распознано: «${result.transcripts[0]}»`
      };
      pulse = 'err';
    }
    render();
  }

  function renderSpellPanel() {
    const word = words[index];
    inputEl = h('input', {
      class: 'input',
      type: 'text',
      inputmode: 'latin',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: false,
      placeholder: 'напиши по-английски',
      value: draft,
      'aria-label': `Написание слова: ${word.ru}`,
      onInput: (event) => { draft = event.target.value; },
      onKeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submitSpelling();
        }
        if (event.key === 'Escape') closePanel();
      }
    });

    return h(
      'div',
      { class: 'panel panel--work' },
      h('p', { class: 'panel__label' }, `Как по-английски «${word.ru}»?`),
      inputEl,
      h('div', { class: 'actions actions--row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: submitSpelling }, 'Проверить'),
        h('button', {
          class: 'btn btn--ghost',
          type: 'button',
          disabled: speaking,
          onClick: () => playWord(word)
        }, speaking ? '🔊 Играет…' : '🔊 Повторить'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: closePanel }, 'Отмена')
      )
    );
  }

  function renderSpeakPanel() {
    const word = words[index];
    return h(
      'div',
      { class: 'panel panel--work' },
      h('p', { class: 'panel__label' }, 'Нажми микрофон и произнеси слово'),
      h('p', { class: 'panel__hint' }, word.transcription || ''),
      h('button', {
        class: `btn btn--mic${listening ? ' is-listening' : ''}`,
        type: 'button',
        disabled: listening,
        onClick: startSpeaking
      }, listening ? '🎙️ Слушаю…' : '🎤 Говорить'),
      h('button', { class: 'btn btn--ghost', type: 'button', onClick: closePanel }, 'Закрыть')
    );
  }

  function starsPossible(word) {
    return word.noSpeak ? 1 : 2;
  }

  function starsEarned(word) {
    const flags = wordFlags(mod.id, word.en);
    return (flags.spell ? 1 : 0) + (word.noSpeak ? 0 : flags.speak ? 1 : 0);
  }

  function render() {
    const word = words[index];
    const flags = wordFlags(mod.id, word.en);
    const speakable = !word.noSpeak;
    // В режиме проверки написания скрываем само слово и транскрипцию —
    // ребёнок пишет по слуху, а не копирует увиденное.
    const hideSpelling = panel === 'spell';

    const card = h(
      'article',
      { class: `word-card${pulse ? ` is-${pulse}` : ''}`, style: { '--accent': mod.color } },
      h('div', { class: 'word-card__head' },
        h('span', { class: 'chip chip--soft' }, mod.shortTitle),
        h('span', { class: 'counter' }, `${index + 1} / ${words.length}`)
      ),
      hideSpelling
        ? h('p', { class: 'word-card__hidden-note' }, '🎧 Слушай и пиши — написание скрыто')
        : h('h2', { class: 'word-card__word' }, word.en),
      hideSpelling
        ? null
        : (word.transcription ? h('p', { class: 'word-card__tr' }, word.transcription) : null),
      h('button', {
        class: `btn btn--speak${speaking ? ' is-speaking' : ''}`,
        type: 'button',
        disabled: speaking,
        onClick: () => playWord(word)
      }, speaking ? '🔊 Играет…' : (hideSpelling ? '🔊 Послушать слово' : '🔊 Слушать')),
      h('div', { class: 'word-card__divider' }),
      h('p', { class: 'word-card__ru' }, word.ru),
      h('div', { class: 'flags' },
        h('span', { class: `flag${flags.spell ? ' flag--done' : ''}` }, `${flags.spell ? '✅' : '⚪'} написание`),
        speakable
          ? h('span', { class: `flag${flags.speak ? ' flag--done' : ''}` }, `${flags.speak ? '✅' : '⚪'} произношение`)
          : h('span', { class: 'flag flag--off' }, '➖ без произношения')
      )
    );

    const swipeWrap = h('div', { class: 'swipe' }, card);
    let swipeStart = null;
    swipeWrap.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input')) return;
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    swipeWrap.addEventListener('pointerup', (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    });
    swipeWrap.addEventListener('pointercancel', () => { swipeStart = null; });

    const actions = h('div', { class: 'actions' },
      h('button', { class: 'btn btn--primary', type: 'button', onClick: openSpell }, '✍️ Слушай и пиши'),
      speakable
        ? h('button', { class: 'btn', type: 'button', onClick: () => { panel = 'speak'; feedback = null; pulse = null; speaking = false; stopSpeech(); render(); } }, '🎤 Проверить произношение')
        : null
    );

    const nav = h('nav', { class: 'nav-row' },
      h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => move(-1) }, '← Назад'),
      h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => move(1) }, 'Далее →')
    );

    root.replaceChildren(...nodes(
      modeHeader({
        title: section.title,
        subtitle: `${mod.shortTitle} · Словарные карточки`,
        onBack: goHome,
        right: h('span', { class: 'stars-inline' }, `⭐ ${starsEarned(word)} / ${starsPossible(word)}`)
      }),
      swipeWrap,
      feedbackBox(feedback),
      panel === 'spell' ? renderSpellPanel() : panel === 'speak' ? renderSpeakPanel() : null,
      actions,
      nav
    ));

    if (panel === 'spell' && inputEl) inputEl.focus();
  }

  const keyHandler = (event) => {
    if (event.target && /input|textarea/i.test(event.target.tagName)) return;
    if (panel) return;
    if (event.key === 'ArrowRight') move(1);
    if (event.key === 'ArrowLeft') move(-1);
  };
  document.addEventListener('keydown', keyHandler);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', keyHandler), { once: true });

  render();
  return root;
}
