#!/usr/bin/env python3
"""Проверка структуры и согласованности контентных JSON модулей.

Поддерживает секционную структуру (1a, 1b, 1c, 1d).
Запуск:  python scripts/validate_content.py  /  npm run validate
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Базовый набор английских слов, известных ученику до модуля
# или встречающихся настолько часто, что проверять их бессмысленно.
COMMON = {
    # артикли
    "the", "a", "an",
    # местоимения
    "i", "you", "he", "she", "it", "we", "they",
    "my", "your", "his", "her", "its", "our", "their",
    "me", "him", "us", "them",
    "this", "that", "these", "those",
    "myself", "yourself", "himself", "herself", "itself",
    "everyone", "everybody", "someone", "somebody", "anyone", "anything",
    "who", "what", "where", "when", "why", "how", "which", "whose",
    # глаголы-связки и вспомогательные
    "be", "am", "is", "are", "was", "were", "been", "being",
    "have", "has", "had", "having",
    "do", "does", "did", "doing", "done",
    "can", "could", "will", "would", "shall", "should",
    "must", "may", "might", "need", "ought",
    "cant", "cannot", "dont", "doesnt", "didnt", "wont", "wouldnt",
    "shouldnt", "mustnt", "couldnt",
    # базовые глаголы и формы
    "go", "goes", "going", "went", "gone",
    "come", "comes", "came", "coming",
    "get", "gets", "got", "getting",
    "make", "makes", "made", "making",
    "take", "takes", "took", "taken", "taking",
    "give", "gives", "gave", "giving",
    "put", "puts", "putting",
    "see", "sees", "saw", "seen", "seeing",
    "look", "looks", "looked", "looking",
    "hear", "hears", "heard",
    "listen", "listens", "listened",
    "say", "says", "said",
    "tell", "tells", "told",
    "ask", "asks", "asked",
    "answer", "answers", "answered",
    "know", "knows", "knew", "known",
    "think", "thinks", "thought",
    "want", "wants", "wanted",
    "like", "likes", "liked", "liking",
    "love", "loves", "loved", "loving",
    "play", "plays", "played", "playing",
    "work", "works", "worked", "working",
    "live", "lives", "lived", "living",
    "eat", "eats", "ate", "eating",
    "drink", "drinks", "drank", "drinking",
    "walk", "walks", "walked", "walking",
    "run", "runs", "ran", "running",
    "sit", "sits", "sat", "sitting",
    "stand", "stands", "stood", "standing",
    "open", "opens", "opened", "opening",
    "close", "closes", "closed", "closing",
    "wear", "wears", "wore", "wearing",
    "wash", "washes", "washed", "washing",
    "read", "reads", "reading",
    "write", "writes", "wrote", "writing",
    "sing", "sings", "sang", "singing",
    "cut", "cuts", "cutting",
    "blow", "blows", "blew", "blowing",
    "buy", "buys", "bought", "buying",
    "bring", "brings", "brought", "bringing",
    "cook", "cooks", "cooked", "cooking",
    "boil", "boils", "boiled", "boiling",
    "fry", "fries", "fried", "frying",
    "bake", "bakes", "baked", "baking",
    "mix", "mixes", "mixed", "mixing",
    "peel", "peels", "peeled", "peeling",
    "add", "adds", "added", "adding",
    "pour", "pours", "poured", "pouring",
    "stir", "stirs", "stirred", "stirring",
    "taste", "tastes", "tasted", "tasting",
    "visit", "visits", "visited", "visiting",
    "travel", "travels", "travelled", "travelling",
    "arrive", "arrives", "arrived", "arriving",
    "depart", "departs", "departed", "departing",
    "pack", "packs", "packed", "packing",
    "book", "books", "booked", "booking",
    "try", "tries", "tried", "trying",
    "fit", "fits", "fitted", "fitting",
    "fit", "fits",
    "enjoy", "enjoys", "enjoyed", "enjoying",
    "relax", "relaxes", "relaxed", "relaxing",
    "recommend", "recommends", "recommended",
    "order", "orders", "ordered", "ordering",
    "found", "lift", "sat", "carried", "sailed", "defended", "conquered",
    "rebuild", "rebuilt", "visited", "became", "took",
    "snows", "raining", "rains", "snowing",
    # предлоги и наречия
    "in", "on", "at", "to", "of", "for", "with", "by", "from",
    "about", "into", "out", "up", "down", "over", "under", "above",
    "below", "near", "behind", "between", "through", "during",
    "before", "after", "against", "without",
    "here", "there", "now", "then", "today", "tomorrow", "yesterday",
    "again", "too", "very", "much", "well", "so", "just", "only",
    "also", "not", "no", "yes", "some", "any", "all", "as", "o'clock",
    "many", "more", "most", "other", "such", "each", "both", "few",
    # союзы
    "and", "or", "but", "because", "if", "than", "that",
    # прилагательные базовые
    "good", "bad", "big", "small", "old", "new", "young",
    "long", "short", "tall", "little", "great", "beautiful",
    "kind", "nice", "different", "same", "whole",
    "strong", "famous", "born", "last",
    "healthy", "quick", "blue", "white", "unforgettable",
    "memorable", "too",
    # существительные базовые
    "day", "days", "week", "weeks", "month", "months", "year", "years",
    "morning", "afternoon", "evening", "night", "time", "times",
    "home", "house", "school", "work", "job", "family", "friend",
    "friends", "people", "man", "woman", "boy", "girl",
    "child", "children", "mum", "dad", "mother", "father",
    "brother", "sister", "uncle", "baby",
    "thing", "things", "way", "name", "place", "places",
    "room", "rooms", "door", "window", "windows", "table", "chair", "chairs",
    "bed", "book", "books", "pen", "paper",
    "food", "water", "tea", "milk", "bread", "apple",
    "car", "bus", "train", "bike",
    "hour", "hours", "minute", "minutes",
    "town", "city", "river", "park", "shop", "street",
    "war", "battle", "enemy", "lands", "ships", "kings", "photos",
    "dinner", "lunch", "breakfast", "class", "classroom",
    "lesson", "game", "games", "turn", "turns", "line", "canteen",
    "question", "answer", "badge", "smoking", "entry", "zone", "parking",
    "slippers", "umbrella", "classmates", "jam", "tuna", "thames",
    "degrees", "view", "nature", "forest", "island", "coast",
    "week", "souvenirs", "photos", "suitcase", "luggage", "passport",
    "camera", "map", "tourist", "sightseeing", "abroad",
    "menu", "chef", "customer", "service", "tip", "dish", "meal",
    "restaurant", "café", "pizzeria", "pub", "resort", "hotel",
    "beach", "seaside", "mountain", "mountains", "camp", "tent",
    "adventure", "adventures",
    # числа
    "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
    "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand",
    "first", "second", "third",
    # дни недели
    "monday", "tuesday", "wednesday", "thursday", "friday",
    "saturday", "sunday", "mondays", "tuesdays", "wednesdays",
    "thursdays", "fridays", "saturdays", "sundays",
    # месяцы
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    # сезоны
    "spring", "summer", "autumn", "winter",
    # прочее
    "oclock", "past", "half", "quarter", "am", "pm",
    "uk", "us", "7", "id", "will", "going", "there", "from",
    # имена собственные — географические названия и языки
    "london", "moscow", "australia", "canada", "english", "russia",
    "scotland", "thames", "britain", "europe", "america", "paris",
    "washington", "edinburgh", "cardiff", "belfast",
    # базовые слова, встречающиеся в reading-текстах (6 класс)
    "always", "around", "brave", "carnival", "corridor", "cross",
    "discovered", "drawing", "eggs", "fasten", "favourite", "fly",
    "follow", "forget", "lemon", "lifted", "newspapers", "next",
    "outside", "pieces", "pizza", "please", "pupil", "pupils",
    "ride", "rules", "sandwiches", "show", "snack", "speaks",
    "story", "swim", "taller", "together", "twin", "wake",
    "world", "wrapped", "yard", "lift", "wears",
}


def try_stem(word, known):
    """Пробуем найти базовую форму слова в known.

    Обрабатывает: множественное число (-s, -es, -ies→y, -ves→f/fe),
    и неправильные множественные (-men→man, -es→is).
    """
    if word in known:
        return True
    if word.endswith("s") and word[:-1] in known:
        return True
    if word.endswith("es") and word[:-2] in known:
        return True
    if word.endswith("ies") and word[:-3] + "y" in known:
        return True
    # knives → knife, wolves → wolf
    if word.endswith("ves") and (word[:-3] + "f" in known or word[:-3] + "fe" in known):
        return True
    # men → man, women → woman
    if word.endswith("men") and word[:-3] + "man" in known:
        return True
    return False


def module_token_set(words):
    """Множество всех токенов лексики (целые фразы + отдельные токены)."""
    tokens = set()
    for w in words:
        en = w.get("en", "").strip().lower()
        if not en:
            continue
        tokens.add(re.sub(r"[^a-z'\-]", "", en))
        for part in re.split(r"[\s\-]+", en):
            part = re.sub(r"[^a-z'\-]", "", part)
            if part:
                tokens.add(part)
    tokens.discard("")
    return tokens


def check_section(path_name, section, problems):
    """Проверяет одну секцию: слова, фразы, чтение."""
    sec_id = section.get("id", "?")
    sec_prefix = f"{path_name} [{sec_id}]"

    words = section.get("words") or []
    sents = section.get("sentences") or []
    reading = section.get("reading") or []

    # Повторы слов внутри секции
    names = [w.get("en", "").strip().lower() for w in words]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        problems.append(f"{sec_prefix}: повтор слов {sorted(dupes)}")

    for w in words:
        if not w.get("en") or not w.get("ru"):
            problems.append(f"{sec_prefix}: слово без en/ru — {w}")
        if not w.get("transcription"):
            problems.append(f"{sec_prefix}: нет транскрипции у {w.get('en')}")

    for s in sents:
        en = (s.get("en") or "").strip()
        expected = re.sub(r"[.!?]+$", "", en).split()
        if s.get("words") != expected:
            problems.append(f"{sec_prefix}: words не совпадает с en — {en!r}: "
                            f"{s.get('words')} vs {expected}")
        if not s.get("ru"):
            problems.append(f"{sec_prefix}: нет перевода у {en!r}")

    return words, sents, reading


def main():
    problems = []   # критические — ломают валидацию
    warnings = []   # некритические — стоит посмотреть, но не блокируют

    cumulative = set(COMMON)

    # Сортируем по числовому номеру модуля, иначе module10 идёт перед module2.
    def module_number(path):
        m = re.match(r"module(\d+)", path.stem)
        return int(m.group(1)) if m else 999

    files = sorted(
        (p for p in DATA.glob("module*.json") if p.name != "modules.json"),
        key=module_number,
    )
    for path in files:
        if path.name == "modules.json":
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"{path.name}: невалидный JSON — {exc}")
            continue

        sections = data.get("sections") or []
        all_words = []
        all_sents = []
        all_reading = []
        sec_count = 0

        for section in sections:
            sec_count += 1
            w, s, r = check_section(path.name, section, problems)
            all_words.extend(w)
            all_sents.extend(s)
            all_reading.extend(r)

        # Повторы слов между секциями одного модуля
        names = [w.get("en", "").strip().lower() for w in all_words]
        cross_dupes = {n for n in names if names.count(n) > 1}
        if cross_dupes:
            problems.append(f"{path.name}: повтор слов между секциями {sorted(cross_dupes)}")

        # Лексика модуля
        mod_tokens = module_token_set(all_words)
        known = cumulative | mod_tokens

        # Проверка фраз для чтения: слова должны быть знакомы.
        # try_stem обрабатывает множественное число и неправильные формы.
        for r in all_reading:
            en = r.get("en") if isinstance(r, dict) else r
            if not en:
                continue
            raw_tokens = re.sub(r"[.!?;:,]+$", "", en.strip().lower()).split()
            unknown = []
            for t in raw_tokens:
                clean = re.sub(r"[^a-z'\-]", "", t)
                if not clean:
                    continue
                if try_stem(clean, known):
                    continue
                unknown.append(t)
            if unknown:
                warnings.append(f"{path.name}: в reading возможны незнакомые слова — "
                                f"{en!r}: {unknown}")

        cumulative |= mod_tokens

        print(f"{path.name:16} секций={sec_count} words={len(all_words):3} "
              f"sentences={len(all_sents):3} reading={len(all_reading):3} "
              f"id={data.get('id')} color={data.get('color')}")

    print()
    if warnings:
        print(f"Предупреждения (не блокируют): {len(warnings)}")
        for w in warnings[:8]:
            print(" ~", w)
        if len(warnings) > 8:
            print(f"   ... и ещё {len(warnings) - 8}")
        print()
    if problems:
        print("ПРОБЛЕМЫ:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("Все файлы в порядке.")


if __name__ == "__main__":
    main()
