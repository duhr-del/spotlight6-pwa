import { h, nodes } from '../ui/dom.js';
import { modeHeader, feedbackBox } from '../ui/header.js';
import { speak, stop as stopSpeech, isSupported as ttsSupported } from '../tts.js';
import { listen, isSupported as sttSupported, describeError, isOnline } from '../speech.js';
import { readingRecord, awardReading } from '../storage.js';
import { readingScore, starsForReading, readingVerdict } from '../match.js';

export function mountReading(ctx) {
  const mod = ctx.module;
  const section = ctx.section;
  const items = section.reading;

  let index = 0;
  let phase = 'idle';   // idle | listening | done
  let result = null;
  let feedback = null;

  const root = h('div', { class: 'screen screen--mode' });

  function changeIndex(delta) {
    index = (index + delta + items.length) % items.length;
    phase = 'idle';
    result = null;
    feedback = null;
    stopSpeech();
    render();
  }

  function playSample() {
    const item = items[index];
    if (!ttsSupported()) {
      feedback = { kind: 'info', text: 'В этом браузере нет синтеза речи. Попробуй Chrome или Edge.' };
      render();
      return;
    }
    speak(item.en, { accent: ctx.settings.accent, rate: Math.max(0.7, ctx.settings.rate - 0.1) });
  }

  async function startReading() {
    const item = items[index];

    if (!sttSupported()) {
      feedback = { kind: 'err', text: describeError('unsupported') };
      render();
      return;
    }

    if (!isOnline()) {
      feedback = {
        kind: 'info',
        text: 'Проверка чтения работает через сервис распознавания речи, ему нужен интернет.',
        hint: 'Образец для прослушивания доступен и офлайн.'
      };
      render();
      return;
    }

    stopSpeech();
    phase = 'listening';
    feedback = null;
    render();

    const response = await listen({ accent: ctx.settings.accent, timeoutMs: 20000 });
    if (!root.isConnected) return;

    if (!response.ok) {
      phase = 'idle';
      feedback = { kind: 'err', text: describeError(response.error) };
      render();
      return;
    }

    const mode = ctx.settings.readingMode === 'strict' ? 'strict' : 'easy';
    const attempts = response.transcripts
      .map((transcript) => ({ transcript, ...readingScore(transcript, item.en, mode) }))
      .sort((a, b) => b.percent - a.percent);

    const best = attempts[0];
    const stars = starsForReading(best.percent);
    const isNew = awardReading(mod.id, item.en, stars, best.percent);

    phase = 'done';
    result = { ...best, stars, isNew, mode, all: attempts.map((attempt) => attempt.transcript) };
    render();
  }

  function renderResult(item) {
    if (!result) return null;
    const verdict = readingVerdict(result.percent);
    // trim() чтобы при случайных пробелах в начале/конце длина массива
    // не разошлась с result.flags (который из tokens() с trim).
    const words = item.en.trim().split(/\s+/);
    const flagFor = (position) => (result.flags[position] ? ' is-good' : ' is-bad');

    return h(
      'section',
      { class: 'panel panel--result' },
      h('div', { class: 'result__head' },
        h('div', { class: 'result__score' },
          h('span', { class: 'result__percent' }, `${result.percent}%`),
          h('span', { class: 'result__caption' }, 'слов распознано')
        ),
        h('div', { class: 'result__verdict' },
          h('p', { class: 'result__title' }, verdict.title),
          h('p', { class: 'muted' }, verdict.note)
        )
      ),
      h('div', { class: 'result__stars' },
        `⭐ ${result.stars} из 3`,
        result.isNew ? h('span', { class: 'badge badge--new' }, 'засчитано') : null
      ),
      h('div', { class: 'heard-words' },
        words.map((word, position) => {
          const clean = word.replace(/[.,!?;:]/g, '');
          return h('span', { class: `heard-word${flagFor(position)}` }, clean || word);
        })
      ),
      h('p', { class: 'heard-line' }, `Я услышал: «${result.transcript}»`),
      result.all.length > 1
        ? h('details', { class: 'variants' },
          h('summary', null, 'Другие варианты распознавания'),
          h('ul', null, ...result.all.slice(1).map((text) => h('li', null, text)))
        )
        : null
    );
  }

  function render() {
    const item = items[index];

    if (!item) {
      root.replaceChildren(
        modeHeader({ title: section.title, subtitle: `${mod.shortTitle} · Проверка чтения`, onBack: () => ctx.go('home') }),
        h('p', { class: 'empty' }, 'В этом модуле пока нет текстов для чтения.')
      );
      return root;
    }

    const best = readingRecord(mod.id, item.en);
    const listening = phase === 'listening';

    const card = h(
      'article',
      { class: 'reading-card', style: { '--accent': mod.color } },
      h('div', { class: 'word-card__head' },
        h('span', { class: 'chip chip--soft' }, mod.shortTitle),
        h('span', { class: 'counter' }, `${index + 1} / ${items.length}`)
      ),
      h('p', { class: 'reading-card__text' }, item.en)
    );

    const buttons = h(
      'div',
      { class: 'actions actions--row' },
      h('button', { class: 'btn', type: 'button', onClick: playSample }, '🔊 Образец'),
      h('button', {
        class: `btn btn--primary${listening ? ' is-listening' : ''}`,
        type: 'button',
        disabled: listening,
        onClick: startReading
      }, listening ? '🎙️ Слушаю…' : '🎤 Читаю')
    );

    root.replaceChildren(...nodes(
      modeHeader({
        title: section.title,
        subtitle: `${mod.shortTitle} · Проверка чтения`,
        onBack: () => { stopSpeech(); ctx.go('home'); },
        right: h('span', { class: 'stars-inline' }, `⭐ ${best.stars} / 3`)
      }),
      h('p', { class: 'mode-hint' }, 'Послушай образец, затем прочитай фразу вслух — микрофон должен её услышать.'),
      card,
      feedbackBox(feedback),
      buttons,
      phase === 'done' ? renderResult(item) : null,
      h('nav', { class: 'nav-row' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => changeIndex(-1) }, '← Назад'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => changeIndex(1) }, 'Далее →')
      )
    ));

    return root;
  }

  return render();
}