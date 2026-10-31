// Прогресс хранится в localStorage. Звёзды не накапливаются счётчиком,
// а выводятся из состояния каждого слова/предложения — повторно накрутить нельзя.

const KEY = 'spotlight6_progress';
const VERSION = 1;

function defaultState() {
  return {
    version: VERSION,
    currentModule: 'module1',
    currentSection: null,  // id секции внутри модуля (1a, 1b, ...); null = первая
    words: {},
    builder: {},
    reading: {},
    settings: { accent: 'en-GB', rate: 0.9, readingMode: 'easy' }
  };
}

let state = null;
let storageAvailable = true;

export function key(word) {
  return String(word ?? '').trim().toLowerCase();
}

export function init() {
  state = defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = migrate({
          ...state,
          ...parsed,
          words: parsed.words && typeof parsed.words === 'object' ? parsed.words : {},
          builder: parsed.builder && typeof parsed.builder === 'object' ? parsed.builder : {},
          reading: parsed.reading && typeof parsed.reading === 'object' ? parsed.reading : {},
          settings: { ...state.settings, ...(parsed.settings || {}) }
        });
      }
    }
  } catch (error) {
    storageAvailable = false;
    console.warn('Не удалось прочитать сохранённый прогресс:', error);
  }
  return state;
}

// Миграция версий: если структура state изменится, здесь можно добавить
// преобразование старого прогресса к новой структуре, не теряя данные.
function migrate(parsed) {
  const fromVersion = Number(parsed.version) || 0;
  // Пример: если когда-то добавится поле lastPracticedAt и старые записи
  // его не имеют — здесь можно пройти по words/builder/reading и дополнить.
  // Сейчас версия 1 — миграций нет, но механизм готов.
  parsed.version = VERSION;

  // Чистим записи слов без полей — на случай повреждённых данных.
  if (parsed.words && typeof parsed.words === 'object') {
    for (const moduleId of Object.keys(parsed.words)) {
      const bucket = parsed.words[moduleId];
      if (!bucket || typeof bucket !== 'object') {
        delete parsed.words[moduleId];
        continue;
      }
      for (const w of Object.keys(bucket)) {
        const record = bucket[w];
        if (!record || typeof record !== 'object') {
          delete bucket[w];
        }
      }
      if (!Object.keys(bucket).length) delete parsed.words[moduleId];
    }
  }

  return parsed;
}

export function get() {
  return state || init();
}

export function isAvailable() {
  return storageAvailable;
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
    console.warn('Не удалось сохранить прогресс:', error);
  }
}

export function commit(mutator) {
  const current = get();
  mutator(current);
  persist();
  return current;
}

export function setCurrentModule(id) {
  commit((s) => {
    s.currentModule = id;
    s.currentSection = null;  // при смене модуля сбрасываем секцию
  });
}

export function setCurrentSection(sectionId) {
  commit((s) => { s.currentSection = sectionId || null; });
}

export function setSetting(name, value) {
  commit((s) => { s.settings[name] = value; });
}

export function resetAll() {
  const keepModule = get().currentModule;
  const keepSection = get().currentSection;
  const fresh = defaultState();
  fresh.currentModule = keepModule;
  fresh.currentSection = keepSection;
  state = fresh;
  persist();
}

/* ---------- слова ---------- */

export function wordFlags(moduleId, word) {
  const bucket = get().words[moduleId];
  const record = (bucket && bucket[key(word)]) || {};
  return { spell: !!record.spell, speak: !!record.speak };
}

export function markWord(moduleId, word, kind) {
  let isNew = false;
  commit((s) => {
    const bucket = s.words[moduleId] || (s.words[moduleId] = {});
    const k = key(word);
    const record = bucket[k] || (bucket[k] = { spell: false, speak: false });
    if (!record[kind]) isNew = true;
    record[kind] = true;
  });
  return isNew;
}

/* ---------- конструктор ---------- */

export function builderStars(moduleId, sentence) {
  const bucket = get().builder[moduleId];
  const value = bucket ? bucket[key(sentence)] : 0;
  return Number(value) || 0;
}

export function awardBuilder(moduleId, sentence, stars = 2) {
  let improved = false;
  commit((s) => {
    const bucket = s.builder[moduleId] || (s.builder[moduleId] = {});
    const k = key(sentence);
    const prev = Number(bucket[k]) || 0;
    if (stars > prev) {
      bucket[k] = stars;
      improved = true;
    }
  });
  return improved;
}

/* ---------- чтение ---------- */

export function readingRecord(moduleId, sentence) {
  const bucket = get().reading[moduleId];
  const record = bucket ? bucket[key(sentence)] : null;
  return { stars: Number(record && record.stars) || 0, percent: Number(record && record.percent) || 0 };
}

export function awardReading(moduleId, sentence, stars, percent) {
  let improved = false;
  commit((s) => {
    const bucket = s.reading[moduleId] || (s.reading[moduleId] = {});
    const k = key(sentence);
    const prev = bucket[k] || { stars: 0, percent: 0 };
    const next = {
      stars: Math.max(Number(prev.stars) || 0, stars),
      percent: Math.max(Number(prev.percent) || 0, Math.round(percent))
    };
    if (next.stars > (Number(prev.stars) || 0)) improved = true;
    bucket[k] = next;
  });
  return improved;
}

/* ---------- агрегаты ---------- */

// Базовая функция: считает статистику по списку слов/фраз/текстов.
// Используется и для секции, и для модуля (модуль = сумма секций).
function statsForContent(moduleId, words, sentences, reading) {
  const s = get();
  const wordBucket = s.words[moduleId] || {};

  let mastered = 0;
  let flashcardStars = 0;
  let flashcardMax = 0;

  for (const word of words) {
    const record = wordBucket[key(word.en)] || {};
    const needsSpeak = !word.noSpeak;
    if (record.spell) flashcardStars += 1;
    if (needsSpeak && record.speak) flashcardStars += 1;
    flashcardMax += needsSpeak ? 2 : 1;
    if (record.spell && (!needsSpeak || record.speak)) mastered += 1;
  }

  const builderBucket = s.builder[moduleId] || {};
  let builderStarsTotal = 0;
  let builderDone = 0;
  for (const item of sentences) {
    const stars = Number(builderBucket[key(item.en)]) || 0;
    builderStarsTotal += stars;
    if (stars > 0) builderDone += 1;
  }

  const readingBucket = s.reading[moduleId] || {};
  let readingStarsTotal = 0;
  let readingDone = 0;
  for (const item of reading) {
    const record = readingBucket[key(item.en)];
    const stars = Number(record && record.stars) || 0;
    readingStarsTotal += stars;
    if (stars > 0) readingDone += 1;
  }

  const builderMax = sentences.length * 2;
  const readingMax = reading.length * 3;

  return {
    mastered,
    wordsTotal: words.length,
    flashcardStars,
    flashcardMax,
    builderStars: builderStarsTotal,
    builderMax,
    builderDone,
    readingStars: readingStarsTotal,
    readingMax,
    readingDone,
    stars: flashcardStars + builderStarsTotal + readingStarsTotal,
    maxStars: flashcardMax + builderMax + readingMax
  };
}

// Статистика одной секции модуля.
export function sectionStats(mod, section) {
  return statsForContent(mod.id, section.words, section.sentences, section.reading);
}

// Статистика модуля целиком — сумма по всем его секциям.
export function moduleStats(mod) {
  const agg = {
    mastered: 0, wordsTotal: 0, flashcardStars: 0, flashcardMax: 0,
    builderStars: 0, builderMax: 0, builderDone: 0,
    readingStars: 0, readingMax: 0, readingDone: 0,
    stars: 0, maxStars: 0
  };
  for (const section of mod.sections || []) {
    const s = statsForContent(mod.id, section.words, section.sentences, section.reading);
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

export function courseStats(modules) {
  const total = { mastered: 0, words: 0, stars: 0, maxStars: 0 };
  const perModule = new Map();
  for (const mod of modules) {
    const stats = moduleStats(mod);
    perModule.set(mod.id, stats);
    total.mastered += stats.mastered;
    total.words += stats.wordsTotal;
    total.stars += stats.stars;
    total.maxStars += stats.maxStars;
  }
  return { ...total, perModule };
}