import { h, nodes } from '../ui/dom.js';
import { modeHeader, feedbackBox } from '../ui/header.js';
import { speak, stop as stopSpeech, isSupported as ttsSupported } from '../tts.js';
import { builderStars, awardBuilder } from '../storage.js';

function shuffle(values, seed) {
  const list = values.slice();
  let state = Math.abs(seed) * 9301 + 49297;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

export function mountBuilder(ctx) {
  const mod = ctx.module;
  const section = ctx.section;
  const items = section.sentences;

  let index = 0;
  let pool = [];        // [{ id, text }] в перемешанном порядке
  let picked = [];      // индексы pool в порядке выбора
  let status = 'idle';  // idle | ok | revealed
  let feedback = null;
  let wrongAt = -1;

  const root = h('div', { class: 'screen screen--mode' });

  function buildPool(forIndex) {
    const words = items[forIndex].words;
    const base = words.map((text, id) => ({ id, text }));
    let mixed = shuffle(base, forIndex + 1);
    // Перемешиваем, пока порядок не совпадёт с правильным.
    // Прошлая версия делала один сдвиг — для 2-словных фраз этого мало.
    if (mixed.length > 1) {
      let attempts = 0;
      while (mixed.every((item, position) => item.id === position) && attempts < 7) {
        mixed = shuffle(base, forIndex + 1 + attempts * 101);
        attempts += 1;
      }
    }
    return mixed;
  }

  function reset(forIndex) {
    pool = buildPool(forIndex);
    picked = [];
    status = 'idle';
    feedback = null;
    wrongAt = -1;
  }

  function changeIndex(delta) {
    index = (index + delta + items.length) % items.length;
    reset(index);
    render();
  }

  function currentSentence() {
    return items[index];
  }

  function check() {
    const sentence = currentSentence();
    const target = sentence.words.map((word) => word.toLowerCase());
    const answer = picked.map((poolIndex) => pool[poolIndex].text.toLowerCase());

    const equal = answer.length === target.length && answer.every((word, position) => word === target[position]);

    if (equal) {
      const isNew = awardBuilder(mod.id, sentence.en, 2);
      status = 'ok';
      wrongAt = -1;
      feedback = {
        kind: 'ok',
        text: isNew ? 'Правильно! +2 ⭐' : 'Правильно! Фраза уже была собрана раньше.'
      };
      render();
      return;
    }

    let mismatch = -1;
    const longest = Math.max(answer.length, target.length);
    for (let i = 0; i < longest; i += 1) {
      if (answer[i] !== target[i]) {
        mismatch = i;
        break;
      }
    }

    wrongAt = mismatch;
    feedback = {
      kind: 'err',
      text: answer.length < target.length
        ? 'Не хватает слов — в предложении больше чипов.'
        : 'Порядок пока не тот. Посмотри на подсвеченное слово.',
      hint: 'Подсказка: начни с подлежащего, потом глагол.'
    };
    status = 'idle';
    render();
  }

  function reveal() {
    picked = pool.map((_, poolIndex) => poolIndex).sort((a, b) => pool[a].id - pool[b].id);
    status = 'revealed';
    wrongAt = -1;
    feedback = {
      kind: 'info',
      text: 'Вот правильный порядок. Прочитай его вслух вместе с озвучкой.',
      hint: currentSentence().ru
    };
    render();
  }

  function saySentence() {
    const sentence = currentSentence();
    if (!ttsSupported()) {
      feedback = { kind: 'info', text: 'В этом браузере нет синтеза речи. Попробуй Chrome или Edge.' };
      render();
      return;
    }
    speak(sentence.en, { accent: ctx.settings.accent, rate: ctx.settings.rate });
  }

  function render() {
    const sentence = currentSentence();

    if (!sentence) {
      root.replaceChildren(
        modeHeader({ title: section.title, subtitle: `${mod.shortTitle} · Собери предложение`, onBack: () => ctx.go('home') }),
        h('p', { class: 'empty' }, 'В этом модуле пока нет предложений.')
      );
      return root;
    }

    const starred = builderStars(mod.id, sentence.en);
    const locked = status !== 'idle';

    const answerArea = h(
      'div',
      { class: `answer-area${picked.length ? '' : ' is-empty'}${status === 'ok' ? ' is-ok' : ''}${wrongAt >= 0 ? ' is-err' : ''}` },
      picked.length
        ? picked.map((poolIndex, position) => h(
          'button',
          {
            class: `chip chip--picked${wrongAt === position ? ' chip--wrong' : ''}`,
            type: 'button',
            disabled: locked,
            onClick: () => {
              picked.splice(position, 1);
              wrongAt = -1;
              feedback = null;
              render();
            }
          },
          pool[poolIndex].text
        ))
        : h('span', { class: 'answer-area__hint' }, 'Нажимай на слова ниже — они встанут сюда')
    );

    const poolArea = h(
      'div',
      { class: 'pool' },
      pool.map((token, poolIndex) => (picked.includes(poolIndex) ? null : h(
        'button',
        {
          class: 'chip',
          type: 'button',
          disabled: locked,
          onClick: () => {
            picked.push(poolIndex);
            wrongAt = -1;
            feedback = null;
            render();
          }
        },
        token.text
      )))
    );

    const actions = status === 'idle'
      ? h('div', { class: 'actions actions--row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: check }, 'Проверить'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: reveal }, 'Пропустить')
      )
      : h('div', { class: 'actions actions--row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: saySentence }, '🔊 Озвучить'),
        h('button', { class: 'btn', type: 'button', onClick: () => changeIndex(1) }, 'Далее →')
      );

    root.replaceChildren(...nodes(
      modeHeader({
        title: section.title,
        subtitle: `${mod.shortTitle} · Собери предложение`,
        onBack: () => { stopSpeech(); ctx.go('home'); },
        right: h('span', { class: 'counter' }, `${index + 1} / ${items.length}`)
      }),
      h('section', { class: 'prompt' },
        h('p', { class: 'prompt__label' }, 'Собери по-английски'),
        h('p', { class: 'prompt__ru' }, sentence.ru)
      ),
      answerArea,
      feedbackBox(feedback),
      h('div', { class: 'pool-label' }, 'Слова'),
      poolArea,
      actions,
      h('nav', { class: 'nav-row' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => changeIndex(-1) }, '← Предыдущее'),
        h('span', { class: `stars-inline${starred ? ' is-filled' : ''}` }, `⭐ ${starred} / 2`),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => changeIndex(1) }, 'Следующее →')
      )
    ));

    return root;
  }

  reset(index);
  return render();
}