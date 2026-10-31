// Загрузка контента: data/modules.json + data/moduleN.json.
// Каждый модуль делится на подмодули-секции (1a, 1b, 1c, 1d).
// Отсутствующие поля аккуратно достраиваются, чтобы правки контента не ломали приложение.

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function toTokens(text) {
  return String(text ?? '')
    .trim()
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeWords(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item && item.en)
    .map((item) => ({
      id: String(item.id || item.en).trim(),
      en: String(item.en).trim(),
      transcription: item.transcription ? String(item.transcription).trim() : '',
      ru: item.ru ? String(item.ru).trim() : '',
      noSpeak: Boolean(item.noSpeak)
    }));
}

function normalizeSentences(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item && item.en)
    .map((item) => {
      const en = String(item.en).trim();
      const words = Array.isArray(item.words) && item.words.length
        ? item.words.map((word) => String(word))
        : toTokens(en);
      return {
        id: String(item.id || en).trim(),
        ru: item.ru ? String(item.ru).trim() : '',
        en,
        words
      };
    });
}

function normalizeReading(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (typeof item === 'string' ? { en: item } : item))
    .filter((item) => item && item.en)
    .map((item) => ({
      id: String(item.id || item.en).trim(),
      en: String(item.en).trim(),
      ru: item.ru ? String(item.ru).trim() : ''
    }));
}

function normalizeSection(section, fallbackLetter) {
  const words = normalizeWords(section.words);
  const sentences = normalizeSentences(section.sentences);
  const reading = normalizeReading(section.reading);

  // Если отдельного списка для чтения нет — берём первые предложения конструктора.
  const readingList = reading.length
    ? reading
    : sentences.slice(0, 10).map((item) => ({ id: item.en, en: item.en, ru: item.ru }));

  return {
    id: String(section.id || fallbackLetter).trim(),
    title: String(section.title || fallbackLetter).trim(),
    words,
    sentences,
    reading: readingList
  };
}

function normalizeModule(meta, file) {
  // Подмодули-секции (1a, 1b, 1c, 1d).
  // Если секций нет — строим одну из плоских полей (обратная совместимость).
  let sections;
  if (Array.isArray(file.sections) && file.sections.length) {
    sections = file.sections.map((section, i) => {
      const fallback = `${meta.order || (i + 1)}${'abcd'[i] || 'a'}`;
      return normalizeSection(section, fallback);
    });
  } else {
    sections = [normalizeSection(file, `${meta.order || 1}a`)];
    // На случай, если title секции не задан явно
    sections[0].title = sections[0].title || `${meta.order || 1}a`;
  }

  return {
    id: meta.id,
    order: Number(meta.order) || 0,
    title: file.title || meta.title || meta.id,
    shortTitle: file.shortTitle || meta.title || file.title || meta.id,
    color: file.color || meta.color || '#4A6FA5',
    sections
  };
}

export async function loadData() {
  const manifest = await fetchJson('data/modules.json');
  const metas = (manifest.modules || []).slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (!metas.length) throw new Error('В data/modules.json нет ни одного модуля');

  const files = await Promise.all(
    metas.map(async (meta) => {
      const file = await fetchJson(`data/${meta.id}.json`).catch((error) => {
        console.warn(`Модуль ${meta.id} не загрузился`, error);
        return null;
      });
      return file ? normalizeModule(meta, file) : null;
    })
  );

  const modules = files.filter(Boolean);
  if (!modules.length) throw new Error('Ни один файл модуля не загрузился');

  const byId = new Map(modules.map((mod) => [mod.id, mod]));
  return { modules, byId };
}
