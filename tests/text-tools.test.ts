import { describe, expect, it } from "vitest";
import {
  changeCase,
  cleanupText,
  countWords,
  findMatches,
  joinLines,
  minimalEdit,
  readingSeconds,
  replaceAll,
  sentencePerParagraph,
  spacedInsertion,
  splitSentences,
  wrapCue,
} from "../packages/protocol/text-tools";

describe("clean up pasted text", () => {
  it("rejoins PDF line wraps, lists and spacing", () => {
    const messy = `Сегодня  мы покажем новую версию   суфлёра. Она
работает быстрее и умеет
следить за голосом ведущего.


• Перескок по тексту голосом
• Подсветка  прочитанного
- Работа в Safari и Chrome



Спасибо, что  смотрите! Подписывайтесь
на канал.`;
    expect(cleanupText(messy)).toBe(
      [
        "Сегодня мы покажем новую версию суфлёра. Она работает быстрее и умеет следить за голосом ведущего.",
        "Перескок по тексту голосом",
        "Подсветка прочитанного",
        "Работа в Safari и Chrome",
        "Спасибо, что смотрите! Подписывайтесь на канал.",
      ].join("\n\n"),
    );
  });

  it("rejoins words hyphenated across lines", () => {
    expect(cleanupText("Это очень инте-\nресная история.")).toBe(
      "Это очень интересная история.",
    );
    // A real hyphenated word before a capital stays.
    expect(cleanupText("Северо-\nЗапад")).toBe("Северо- Запад");
  });

  it("keeps dialogue dashes, numbered lists and cues", () => {
    const text =
      "— Привет!\n— Привет, как дела?\n\n1. Первое\n2. Второе [пауза]";
    expect(cleanupText(text)).toBe(
      "— Привет!\n\n— Привет, как дела?\n\n1. Первое 2. Второе [пауза]",
    );
  });

  it("handles Windows line endings and non-breaking spaces", () => {
    expect(cleanupText("One two\r\nthree\r\n\r\nFour")).toBe(
      "One two three\n\nFour",
    );
  });

  it("is stable when run twice", () => {
    const once = cleanupText("A  b\nc\n\n\n• d");
    expect(cleanupText(once)).toBe(once);
  });
});

describe("one sentence per paragraph", () => {
  it("splits sentences in Russian, Ukrainian and English", () => {
    expect(
      sentencePerParagraph(
        "Сегодня мы покажем суфлёр. Он быстрый! Правда? Да…",
      ),
    ).toBe("Сегодня мы покажем суфлёр.\n\nОн быстрый!\n\nПравда?\n\nДа…");
    expect(sentencePerParagraph("Привіт. Як справи?")).toBe(
      "Привіт.\n\nЯк справи?",
    );
    expect(sentencePerParagraph("Hello there. How are you?")).toBe(
      "Hello there.\n\nHow are you?",
    );
  });

  it("does not split initials, abbreviations or decimals", () => {
    expect(
      splitSentences("А. С. Пушкин родился в 1799 г. в Москве. Это факт."),
    ).toEqual(["А. С. Пушкин родился в 1799 г. в Москве.", "Это факт."]);
    expect(splitSentences("Т. е. так и т. д. Далее.")).toEqual([
      "Т. е. так и т. д. Далее.",
    ]);
    expect(splitSentences("Dr. Smith paid 3.5 dollars. Then left.")).toEqual([
      "Dr. Smith paid 3.5 dollars.",
      "Then left.",
    ]);
  });

  it("keeps quotes and cues with their sentences", () => {
    expect(
      splitSentences(
        "Он сказал: «Стоп.» [пауза] Потом ушёл. «Почему?» — спросил я.",
      ),
    ).toEqual([
      "Он сказал: «Стоп.»",
      "[пауза] Потом ушёл.",
      "«Почему?» — спросил я.",
    ]);
  });

  it("keeps existing paragraphs separate", () => {
    expect(sentencePerParagraph("Один. Два.\n\nТри.")).toBe(
      "Один.\n\nДва.\n\nТри.",
    );
  });
});

describe("selection tools", () => {
  it("joins lines into one paragraph", () => {
    expect(joinLines("Первая строка\nвторая\n\n  третья ")).toBe(
      "Первая строка вторая третья",
    );
  });

  it("wraps a selection as a cue", () => {
    expect(wrapCue("  смотреть в камеру ")).toBe("[смотреть в камеру]");
    expect(wrapCue("[уже] ремарка")).toBe("[уже ремарка]");
    expect(wrapCue("   ")).toBe("");
  });

  it("changes case", () => {
    expect(changeCase("ВАЖНО: это тест. ещё один! ok", "sentence")).toBe(
      "Важно: это тест. Ещё один! Ok",
    );
    expect(changeCase("шановні глядачі", "upper", "uk")).toBe(
      "ШАНОВНІ ГЛЯДАЧІ",
    );
    expect(changeCase("Hello World", "lower", "en")).toBe("hello world");
  });

  it("spaces an inserted cue from its neighbours", () => {
    expect(spacedInsertion("словослово", 5, "[пауза]")).toBe(" [пауза] ");
    expect(spacedInsertion("слово слово", 6, "[пауза]")).toBe("[пауза] ");
    expect(spacedInsertion("", 0, "[пауза]")).toBe("[пауза]");
  });

  it("counts words and reading time", () => {
    expect(countWords("  один два\nтри ")).toBe(3);
    expect(countWords("   ")).toBe(0);
    expect(readingSeconds(150, 1)).toBe(60);
    expect(readingSeconds(150, 2)).toBe(30);
  });
});

describe("find and replace", () => {
  it("finds matches with and without case", () => {
    expect(findMatches("Teleo teleo TELEO", "teleo")).toHaveLength(3);
    expect(findMatches("Teleo teleo TELEO", "teleo", true)).toEqual([[6, 11]]);
    expect(findMatches("a.b axb", ".")).toEqual([[1, 2]]);
    expect(findMatches("абв", "")).toEqual([]);
  });

  it("replaces all matches", () => {
    expect(replaceAll("Привет, мир! привет!", "привет", "Здравствуй")).toEqual({
      text: "Здравствуй, мир! Здравствуй!",
      count: 2,
    });
  });
});

describe("minimal edit", () => {
  it("replaces only the changed middle", () => {
    expect(minimalEdit("abc  def", "abc def")).toEqual({
      start: 4,
      end: 5,
      text: "",
    });
    expect(minimalEdit("same", "same")).toEqual({ start: 4, end: 4, text: "" });
    const before = "Один. Два.",
      after = sentencePerParagraph(before),
      e = minimalEdit(before, after);
    expect(before.slice(0, e.start) + e.text + before.slice(e.end)).toBe(after);
  });
});
