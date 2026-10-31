// Нормализация текста и все сравнения «сказано / написано» с эталоном.

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Убираем пунктуацию, но сохраняем апостроф внутри слова: newsagent's, o'clock.
export function stripPunctuation(text) {
  return normalize(text)
    .replace(/[.,!?;:"()«»—–]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(text) {
  const clean = stripPunctuation(text);
  return clean ? clean.split(' ') : [];
}

function squash(text) {
  return stripPunctuation(text).replace(/[^a-z0-9]/g, '');
}

/**
 * Проверка написания. Допускаем:
 *  - разный регистр, лишние пробелы, точку в конце;
 *  - дефис или пробел (middle-aged / middle aged);
 *  - потерянный апостроф (newsagents / newsagent's).
 */
export function spellingOk(input, target) {
  const typed = stripPunctuation(input);
  const wanted = stripPunctuation(target);
  if (!typed) return false;
  if (typed === wanted) return true;
  if (typed.replace(/-/g, ' ') === wanted.replace(/-/g, ' ')) return true;
  return squash(typed) === squash(wanted);
}

export function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  let previous = new Array(t.length + 1);
  let current = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) previous[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[t.length];
}

function toleranceFor(target) {
  const length = squash(target).length;
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Распознанное слово считается верным, если совпал хотя бы один вариант
 * распознавания: точное совпадение, либо опечатка распознавателя в пределах допуска.
 */
export function spokenMatches(transcripts, target) {
  const wanted = stripPunctuation(target);
  if (!wanted) return false;
  const wantedWords = wanted.split(' ');
  const tolerance = toleranceFor(target);

  for (const raw of transcripts || []) {
    const heard = stripPunctuation(raw);
    if (!heard) continue;
    if (heard === wanted) return true;

    if (wantedWords.length === 1) {
      if (levenshtein(heard, wanted) <= tolerance) return true;
    } else {
      const heardWords = heard.split(' ');
      const recall = multisetRecall(heardWords, wantedWords);
      if (recall.matched === wantedWords.length) return true;
      if (levenshtein(heard.replace(/ /g, ''), wanted.replace(/ /g, '')) <= 2) return true;
    }
  }
  return false;
}

/**
 * Считает, сколько слов эталона присутствует в распознанном тексте,
 * с учётом повторов (два «the» требуют двух произнесённых «the»).
 */
export function multisetRecall(spokenWords, targetWords) {
  const pool = new Map();
  for (const word of spokenWords) pool.set(word, (pool.get(word) || 0) + 1);

  const flags = [];
  let matched = 0;
  for (const word of targetWords) {
    const left = pool.get(word) || 0;
    if (left > 0) {
      pool.set(word, left - 1);
      flags.push(true);
      matched += 1;
    } else {
      flags.push(false);
    }
  }
  return { matched, total: targetWords.length, flags };
}

/**
 * Длина наибольшей общей подпоследовательности и отметки совпавших слов эталона.
 * Используется в строгом режиме чтения: порядок слов должен сохраняться.
 */
export function sequenceMatch(spokenWords, targetWords) {
  const n = targetWords.length;
  const m = spokenWords.length;
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      table[i][j] = targetWords[i - 1] === spokenWords[j - 1]
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const flags = new Array(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (targetWords[i - 1] === spokenWords[j - 1]) {
      flags[i - 1] = true;
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return { matched: table[n][m], total: n, flags };
}

export function readingScore(spoken, target, mode = 'easy') {
  const spokenWords = tokens(spoken);
  const targetWords = tokens(target);
  if (!targetWords.length) {
    return { percent: 0, matched: 0, total: 0, flags: [], spokenWords, targetWords };
  }
  const result = mode === 'strict'
    ? sequenceMatch(spokenWords, targetWords)
    : multisetRecall(spokenWords, targetWords);

  return {
    ...result,
    percent: Math.round((result.matched / targetWords.length) * 100),
    spokenWords,
    targetWords
  };
}

export function starsForReading(percent) {
  if (percent >= 90) return 3;
  if (percent >= 70) return 2;
  if (percent >= 50) return 1;
  return 0;
}

export function readingVerdict(percent) {
  if (percent >= 90) return { title: 'Отлично!', note: 'Почти всё расслышано верно.' };
  if (percent >= 70) return { title: 'Хорошо!', note: 'Пара слов потерялась — попробуй ещё раз.' };
  if (percent >= 50) return { title: 'Неплохо', note: 'Половина слов на месте. Читай чуть громче и медленнее.' };
  return { title: 'Попробуй ещё раз', note: 'Слышно мало слов. Проверь микрофон и читай ближе к нему.' };
}