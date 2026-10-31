// Обёртка над window.speechSynthesis: список голосов, выбор британского/американского,
// воспроизведение с промисом и корректной отменой.

let voicesPromise = null;
let cachedVoices = [];

export function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function loadVoices() {
  if (!isSupported()) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const initial = synth.getVoices();
    if (initial && initial.length) {
      cachedVoices = initial;
      resolve(initial);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cachedVoices = synth.getVoices() || [];
      resolve(cachedVoices);
    };

    synth.addEventListener('voiceschanged', finish, { once: true });
    // Некоторые сборки Chromium не присылают voiceschanged — не ждём вечно.
    setTimeout(finish, 1500);
  });

  return voicesPromise;
}

export function refreshVoices() {
  if (!isSupported()) return [];
  cachedVoices = window.speechSynthesis.getVoices() || [];
  return cachedVoices;
}

export function listVoices() {
  return cachedVoices.slice();
}

function pickVoice(accent) {
  if (!cachedVoices.length) return null;
  const wanted = String(accent).replace('_', '-').toLowerCase();
  const sameLang = cachedVoices.filter((voice) => String(voice.lang).replace('_', '-').toLowerCase() === wanted);
  if (sameLang.length) {
    const preferred = sameLang.find((voice) => /google|microsoft|samantha|daniel|kate|serena/i.test(voice.name));
    return preferred || sameLang[0];
  }
  const english = cachedVoices.find((voice) => /^en/i.test(voice.lang));
  return english || null;
}

export function speak(text, { accent = 'en-GB', rate = 0.9 } = {}) {
  return new Promise((resolve) => {
    if (!isSupported()) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }
    const synth = window.speechSynthesis;

    try { synth.cancel(); } catch (error) { /* игнорируем */ }

    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = accent;
    utterance.rate = rate;
    utterance.pitch = 1;

    const voice = pickVoice(accent);
    if (voice) utterance.voice = voice;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    utterance.onend = () => finish({ ok: true });
    utterance.onerror = (event) => finish({ ok: false, reason: (event && event.error) || 'error' });

    try {
      synth.speak(utterance);
    } catch (error) {
      finish({ ok: false, reason: 'error' });
    }
    // Страховка: если браузер так и не прислал ни onend, ни onerror.
    setTimeout(() => finish({ ok: true, timeout: true }), 12000);
  });
}

export function stop() {
  if (!isSupported()) return;
  try { window.speechSynthesis.cancel(); } catch (error) { /* игнорируем */ }
}

export function isSpeaking() {
  return isSupported() && window.speechSynthesis.speaking;
}