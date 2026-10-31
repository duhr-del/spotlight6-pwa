import assert from 'node:assert/strict';
import {
  spellingOk,
  spokenMatches,
  readingScore,
  starsForReading,
  multisetRecall,
  levenshtein
} from '../js/match.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error('FAIL:', name);
    console.error('     ', error.message);
  }
}

check('регистр и пробелы не важны', () => {
  assert.equal(spellingOk('  Mother ', 'mother'), true);
  assert.equal(spellingOk('MOTHER', 'mother'), true);
});

check('опечатка не проходит', () => {
  assert.equal(spellingOk('mothar', 'mother'), false);
  assert.equal(spellingOk('', 'mother'), false);
});

check('дефис и пробел равнозначны', () => {
  assert.equal(spellingOk('middle aged', 'middle-aged'), true);
  assert.equal(spellingOk('middle-aged', 'middle-aged'), true);
});

check('апостроф можно потерять', () => {
  assert.equal(spellingOk('newsagents', "newsagent's"), true);
  assert.equal(spellingOk("newsagent's", "newsagent's"), true);
});

check('точка в конце не мешает', () => {
  assert.equal(spellingOk('slim.', 'slim'), true);
});

check('чужая фраза не проходит', () => {
  assert.equal(spellingOk('the capital of the UK', 'London is the capital of the UK'), false);
});

check('леванштейн считает расстояние', () => {
  assert.equal(levenshtein('mother', 'mother'), 0);
  assert.equal(levenshtein('mother', 'mothar'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

check('распознанное слово с опечаткой засчитывается', () => {
  assert.equal(spokenMatches(['mother'], 'mother'), true);
  assert.equal(spokenMatches(['mothar'], 'mother'), true);
  assert.equal(spokenMatches(['brather'], 'brother'), true);
});

check('короткие слова требуют точного совпадения', () => {
  assert.equal(spokenMatches(['son'], 'son'), true);
  assert.equal(spokenMatches(['sun'], 'son'), false);
});

check('фраза целиком', () => {
  assert.equal(spokenMatches(['fair wavy hair'], 'fair wavy hair'), true);
  assert.equal(spokenMatches(['hair wavy fair'], 'fair wavy hair'), true);
  assert.equal(spokenMatches(['fair hair'], 'fair wavy hair'), false);
});

check('полное совпадение чтения = 100%', () => {
  assert.equal(readingScore('He is tall and slim', 'He is tall and slim.', 'easy').percent, 100);
});

check('пропуск слов снижает процент', () => {
  assert.equal(readingScore('he is tall', 'He is tall and slim', 'easy').percent, 60);
});

check('повторы слов считаются по кратности', () => {
  const result = readingScore('London is capital of UK', 'London is the capital of the UK', 'easy');
  assert.equal(result.total, 7);
  assert.equal(result.matched, 5);
  assert.equal(result.percent, 71);
});

check('свободный порядок выше строгого', () => {
  const easy = readingScore('slim tall and is he', 'He is tall and slim', 'easy');
  const strict = readingScore('slim tall and is he', 'He is tall and slim', 'strict');
  assert.equal(easy.percent, 100);
  assert.ok(strict.percent < 100, `строгий режим должен быть ниже, получили ${strict.percent}`);
});

check('отметки слов совпадают с количеством', () => {
  const result = readingScore('He is tall', 'He is tall and slim', 'easy');
  assert.equal(result.flags.length, 5);
  assert.deepEqual(result.flags, [true, true, true, false, false]);
});

check('мультимножество не считает лишнее', () => {
  assert.equal(multisetRecall(['the', 'the'], ['the']).matched, 1);
});

check('пороговые звёзды', () => {
  assert.equal(starsForReading(100), 3);
  assert.equal(starsForReading(90), 3);
  assert.equal(starsForReading(89), 2);
  assert.equal(starsForReading(70), 2);
  assert.equal(starsForReading(69), 1);
  assert.equal(starsForReading(50), 1);
  assert.equal(starsForReading(49), 0);
  assert.equal(starsForReading(0), 0);
});

check('пустой эталон не делит на ноль', () => {
  assert.equal(readingScore('', '', 'easy').percent, 0);
});

console.log(`Пройдено: ${passed}, провалено: ${failed}`);
if (failed > 0) process.exitCode = 1;