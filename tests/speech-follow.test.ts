import { describe, expect, it } from "vitest";
import {
  SpeechFollower,
  annotationRanges,
  fuzzyWordMatch,
  speechLanguage,
} from "../packages/protocol/speech-follow";

/** Feed growing partial transcripts the way a recognizer delivers them. */
function speak(follower: SpeechFollower, words: string[], from = 0) {
  let transcript = "";
  let now = from;
  for (const word of words) {
    transcript = transcript ? `${transcript} ${word}` : word;
    now += 100;
    follower.match(transcript, now);
  }
  return transcript;
}
const at = (text: string, word: string, nth = 0) => {
  let index = -1;
  for (let i = 0; i <= nth; i++) index = text.indexOf(word, index + 1);
  return index;
};

describe("voice follow alignment", () => {
  it("follows exact reading word by word", () => {
    const text = "Hello everyone and welcome to the show.";
    const f = new SpeechFollower(text);
    speak(f, ["hello", "everyone", "and"]);
    expect(f.position).toBe(at(text, "welcome"));
    speak(f, ["hello", "everyone", "and", "welcome", "to", "the", "show"]);
    expect(f.position).toBe(text.length);
  });

  it("keeps original offsets across blank lines and paragraphs", () => {
    const text = "Перший абзац тексту.\n\nДругий абзац продовжує історію.";
    const f = new SpeechFollower(text);
    speak(f, ["перший", "абзац", "тексту"]);
    expect(f.position).toBe(at(text, "Другий"));
    speak(f, ["перший", "абзац", "тексту", "другий", "абзац"]);
    expect(f.position).toBe(at(text, "продовжує"));
  });

  it("tolerates inflection, ё/е and recognizer typos", () => {
    const text = "Ещё одна важная презентация для команды разработчиков.";
    const f = new SpeechFollower(text);
    speak(f, ["еще", "одна", "важная", "презентации", "для", "команды"]);
    expect(f.position).toBe(at(text, "разработчиков"));
  });

  it("skips extra recognized words and missed script words", () => {
    const text = "We ship the connector to every workspace this quarter.";
    const f = new SpeechFollower(text);
    // "um" inserted, "the" dropped by the recognizer.
    speak(f, ["we", "um", "ship", "connector", "to", "every", "workspace"]);
    expect(f.position).toBe(at(text, "this"));
  });

  it("never needs bracketed cues to be spoken", () => {
    const text = "Start here. [pause] [smile at camera] Then continue.";
    expect(annotationRanges(text)).toHaveLength(2);
    const f = new SpeechFollower(text);
    speak(f, ["start", "here"]);
    expect(f.position).toBe(at(text, "Then"));
  });

  it("starts after a leading cue", () => {
    const text = "[intro music] Good evening.";
    expect(new SpeechFollower(text).position).toBe(at(text, "Good"));
  });

  it("does not jump far ahead on one unconfirmed match", () => {
    const text =
      "one two three four five six seven eight nine ten. The market grows quickly every single year.";
    const f = new SpeechFollower(text);
    f.match("market", 100);
    expect(f.position).toBeLessThan(at(text, "two"));
    f.match("market grows", 200);
    expect(f.position).toBeLessThan(at(text, "two"));
  });

  it("does not move backwards", () => {
    const text = "alpha bravo charlie delta echo foxtrot";
    const f = new SpeechFollower(text);
    speak(f, ["alpha", "bravo", "charlie", "delta"]);
    const reached = f.position;
    f.match("alpha", 10_000);
    expect(f.position).toBe(reached);
  });

  it("resumes from a jump without re-reading the old transcript", () => {
    const text = "first part of the speech. second part continues right here.";
    const f = new SpeechFollower(text);
    const said = speak(f, ["first", "part", "of"]);
    f.jump(at(text, "second"), 1000);
    f.match(`${said} second part`, 1500);
    expect(f.position).toBe(at(text, "continues"));
  });

  it("snaps a jump inside a word to the word's start", () => {
    const text = "first part of the speech. second part continues right here.";
    const f = new SpeechFollower(text);
    expect(f.jump(at(text, "second") + 3, 0)).toBe(at(text, "second"));
    expect(new SpeechFollower(text, 2).position).toBe(0);
  });

  it("ignores results that arrive right after a jump", () => {
    const text = "first part of the speech. second part continues right here.";
    const f = new SpeechFollower(text);
    const target = at(text, "second");
    f.jump(target, 1000);
    f.match("first part of the speech second part continues", 1100);
    expect(f.position).toBe(target);
  });

  it("continues after the recognizer restarts its session", () => {
    const text = "red orange yellow green blue indigo violet";
    const f = new SpeechFollower(text);
    speak(f, ["red", "orange", "yellow"]);
    f.restart();
    speak(f, ["green", "blue"], 5000);
    expect(f.position).toBe(at(text, "indigo"));
  });

  it("advances on a partially recognized word", () => {
    const text = "Teleprompters help speakers.";
    const f = new SpeechFollower(text);
    f.match("telepro", 100);
    expect(f.position).toBe(at(text, "help"));
  });

  it("catches up when a long phrase arrives in one result", () => {
    const text =
      "Сьогодні ми поговоримо про нову версію застосунку та її головні можливості для команди.";
    const f = new SpeechFollower(text);
    f.match(
      "сьогодні ми поговоримо про нову версію застосунку та її головні",
      100,
    );
    expect(f.position).toBe(at(text, "можливості"));
  });

  it("splits fuzzy matching by word length", () => {
    expect(fuzzyWordMatch("or", "organization")).toBe(false);
    expect(fuzzyWordMatch("кіт", "кит")).toBe(true);
    expect(fuzzyWordMatch("teleprompter", "teleprompters")).toBe(true);
    expect(fuzzyWordMatch("table", "chair")).toBe(false);
    expect(fuzzyWordMatch("розділ", "розповімо")).toBe(false);
    expect(fuzzyWordMatch("приходить", "при")).toBe(false);
    expect(fuzzyWordMatch("рука", "руки")).toBe(true);
  });

  it("guesses the speech language of a script", () => {
    expect(speechLanguage("Привіт, як справи? Їжак ґанок", "en")).toBe("uk-UA");
    expect(speechLanguage("Съешь же ещё этих мягких булок", "en")).toBe(
      "ru-RU",
    );
    expect(speechLanguage("Hello and welcome", "ru")).toBe("en-US");
    expect(speechLanguage("Добрий день", "uk")).toBe("uk-UA");
    expect(speechLanguage("", "ru")).toBe("ru-RU");
  });
});

describe("voice follow jumps (skip ahead, other paragraph, go back)", () => {
  const story = [
    "Добрий вечір, шановні глядачі.",
    "Сьогодні ми розповімо про нову версію застосунку для суфлера. Вона працює швидше і стежить за голосом ведучого.",
    "Другий розділ присвячений налаштуванням шрифту, ширини рядка та дзеркального відображення тексту.",
    "Третій розділ пояснює підключення телефона як пульта через QR-код.",
    "На завершення подякуємо команді та відповімо на запитання глядачів.",
  ].join("\n\n");
  const words = (from: string, count: number) => {
    const start = story.indexOf(from);
    return story
      .slice(start)
      .replace(/[.,]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .slice(0, count);
  };
  /** Continue one recognizer session with more words. */
  const continueSaying = (
    f: SpeechFollower,
    transcript: string,
    more: string[],
    from: number,
  ) => {
    let now = from;
    for (const word of more) {
      transcript = transcript ? `${transcript} ${word}` : word;
      now += 100;
      f.match(transcript, now);
    }
    return transcript;
  };

  it("skips the rest of a sentence and continues further in the paragraph", () => {
    const f = new SpeechFollower(story);
    let said = continueSaying(f, "", words("Добрий", 4), 0);
    said = continueSaying(f, said, words("Сьогодні", 3), 1000); // stops mid-line
    continueSaying(f, said, words("стежить", 4), 2000);
    expect(f.position).toBe(at(story, "Другий"));
  });

  it("jumps forward to another paragraph", () => {
    const f = new SpeechFollower(story);
    const said = continueSaying(f, "", words("Добрий", 4), 0);
    continueSaying(f, said, words("Третій", 4), 1000);
    expect(f.position).toBe(at(story, "телефона"));
  });

  it("goes back and re-reads an earlier paragraph", () => {
    const f = new SpeechFollower(story);
    let said = continueSaying(f, "", words("Добрий", 4), 0);
    said = continueSaying(f, said, words("Сьогодні", 30), 1000);
    expect(f.position).toBeGreaterThan(at(story, "Другий"));
    continueSaying(f, said, words("Сьогодні", 5), 5000);
    expect(f.position).toBe(at(story, "версію"));
  });

  it("keeps following normally after a jump", () => {
    const f = new SpeechFollower(story);
    let said = continueSaying(f, "", words("Добрий", 4), 0);
    said = continueSaying(f, said, words("Другий", 4), 1000);
    continueSaying(f, said, ["ширини", "рядка"], 2000);
    expect(f.position).toBe(at(story, "та дзеркального"));
  });

  it("does not jump on off-script talk", () => {
    const f = new SpeechFollower(story);
    const said = continueSaying(f, "", words("Добрий", 4), 0);
    const reached = f.position;
    continueSaying(
      f,
      said,
      ["зараз", "трохи", "відволічуся", "на", "каву", "і", "повернуся"],
      1000,
    );
    expect(f.position).toBe(reached);
  });

  it("needs one more matching word before jumping far", () => {
    const f = new SpeechFollower(story);
    const said = continueSaying(f, "", words("Добрий", 4), 0);
    const reached = f.position;
    continueSaying(f, said, words("Третій", 3), 1000);
    expect(f.position).toBe(reached);
  });

  it("chooses the nearest occurrence of a repeated phrase", () => {
    const repeated = [
      "Вступ до теми сьогоднішньої зустрічі.",
      "Дякуємо всім за увагу та підтримку.",
      "Основна частина про нові можливості продукту.",
      "Дякуємо всім за увагу та підтримку.",
      "Фінал.",
    ].join("\n\n");
    const f = new SpeechFollower(repeated);
    const said = continueSaying(
      f,
      "",
      ["вступ", "до", "теми", "сьогоднішньої", "зустрічі"],
      0,
    );
    continueSaying(f, said, ["дякуємо", "всім", "за", "увагу"], 1000);
    expect(f.position).toBe(at(repeated, "та підтримку"));
  });
});
