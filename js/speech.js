// Обёртка над SpeechRecognition. Один вызов = одна фраза, промис с вариантами распознавания.
// Внимание: в Chrome распознавание идёт через серверы Google и требует интернета.

const MESSAGES = {
  unsupported: 'Этот браузер не умеет распознавать речь. Открой приложение в Chrome или Edge.',
  'not-allowed': 'Браузер не разрешил доступ к микрофону. Разреши микрофон в настройках сайта.',
  'service-not-allowed': 'Распознавание речи запрещено в настройках браузера.',
  'audio-capture': 'Микрофон не найден. Проверь, что он подключён.',
  network: 'Нет связи с сервисом распознавания. Нужен интернет — включи Wi-Fi.',
  'no-speech': 'Я ничего не услышал. Попробуй ещё раз, ближе к микрофону.',
  aborted: 'Запись прервана.',
  'language-not-supported': 'Русскоязычный браузер не поддерживает этот язык распознавания.',
  timeout: 'Слишком долго тишина. Нажми микрофон и прочитай ещё раз.',
  busy: 'Распознавание уже запущено. Подожди секунду.',
  error: 'Не получилось распознать речь. Попробуй ещё раз.'
};

export function describeError(code) {
  return MESSAGES[code] || MESSAGES.error;
}

export function isSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listen({ accent = 'en-GB', timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      resolve({ ok: false, transcripts: [], error: 'unsupported' });
      return;
    }

    let recognition;
    try {
      recognition = new Recognition();
    } catch (error) {
      resolve({ ok: false, transcripts: [], error: 'error' });
      return;
    }

    recognition.lang = accent;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    let settled = false;
    let timer = null;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { recognition.abort(); } catch (error) { /* уже остановлено */ }
      resolve(payload);
    };

    recognition.onresult = (event) => {
      const result = event.results && event.results[0];
      const transcripts = [];
      if (result) {
        for (let i = 0; i < result.length; i += 1) {
          const alternative = result[i];
          if (alternative && alternative.transcript) transcripts.push(alternative.transcript);
        }
      }
      finish({
        ok: transcripts.length > 0,
        transcripts,
        error: transcripts.length ? null : 'no-speech'
      });
    };

    recognition.onerror = (event) => {
      finish({ ok: false, transcripts: [], error: (event && event.error) || 'error' });
    };

    recognition.onend = () => {
      if (!settled) finish({ ok: false, transcripts: [], error: 'no-speech' });
    };

    timer = setTimeout(() => finish({ ok: false, transcripts: [], error: 'timeout' }), timeoutMs);

    try {
      recognition.start();
    } catch (error) {
      finish({ ok: false, transcripts: [], error: 'busy' });
    }
  });
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}