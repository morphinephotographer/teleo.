import { createScript, type Script } from "../../../packages/protocol/domain";
import type { Locale } from "./i18n";
export const welcomeId = "9cb462aa-2cc0-4f38-8bde-bb2845b748e5";
export const welcomeBodies: Record<Locale, string> = {
  ru: `Привет! Добро пожаловать в Teleo.

Ваши слова. Ваш темп.

Teleo. — это современный телепромптер, который помогает говорить свободно, уверенно и естественно перед камерой.

Больше не нужно запоминать длинные тексты или постоянно заглядывать в заметки. Просто напишите свой сценарий, нажмите Play — и текст начнёт плавно двигаться по экрану.

Попробуйте изменить скорость воспроизведения. Сделайте прокрутку быстрее или медленнее, чтобы найти комфортный для себя ритм.

Теперь настройте размер текста, межстрочный интервал и ширину строк. Всё должно быть удобно именно вам.

Вы также можете переходить между абзацами или перематывать текст на любую позицию.

А если ваш телепромптер находится рядом с камерой, используйте iPhone как беспроводной пульт управления.

Следите за текущим текстом, управляйте воспроизведением и меняйте настройки прямо во время записи.

Для профессиональной съёмки предусмотрены зеркальный режим, направляющая чтения и дополнительные инструменты.

Создавайте сценарии, записывайте видео, проводите презентации и делитесь своими идеями.

Teleo. — Your words. Your pace.`,
  en: `Hello! Welcome to Teleo.

Your words. Your pace.

Teleo. is a modern teleprompter that helps you speak freely, confidently and naturally on camera.

There’s no need to memorize long scripts or keep glancing at your notes. Simply write your script, press Play, and watch the text scroll smoothly across the screen.

Try changing the playback speed. Make the text move faster or slower until you find a rhythm that feels right.

Now adjust the text size, line spacing and line width. Make everything comfortable for you.

You can also move between paragraphs or jump to any point in your script.

If your teleprompter is beside the camera, use your iPhone as a wireless remote.

Follow the current text, control playback and adjust settings while you record.

For professional shoots, you’ll find mirror mode, a reading guide and more tools to help you stay focused.

Create scripts, record videos, give presentations and share your ideas.

Teleo. — Your words. Your pace.`,
  uk: `Привіт! Ласкаво просимо до Teleo.

Ваші слова. Ваш темп.

Teleo. — це сучасний телесуфлер, який допомагає говорити вільно, впевнено й природно перед камерою.

Більше не потрібно запам’ятовувати довгі тексти чи постійно зазирати в нотатки. Просто напишіть свій сценарій, натисніть Play — і текст почне плавно рухатися екраном.

Спробуйте змінити швидкість відтворення. Зробіть прокрутку швидшою або повільнішою, щоб знайти зручний для себе ритм.

Тепер налаштуйте розмір тексту, міжрядковий інтервал і ширину рядків. Усе має бути зручним саме для вас.

Ви також можете переходити між абзацами або перемотувати текст до будь-якого місця.

А якщо ваш телесуфлер розташований поруч із камерою, використовуйте iPhone як бездротовий пульт керування.

Стежте за поточним текстом, керуйте відтворенням і змінюйте налаштування просто під час запису.

Для професійної зйомки передбачені дзеркальний режим, напрямна читання та додаткові інструменти.

Створюйте сценарії, записуйте відео, проводьте презентації та діліться своїми ідеями.

Teleo. — Your words. Your pace.`,
};
export type DemoRecord = {
  id: string;
  title: string;
  body: string;
  locale: Locale;
};
export type WelcomeSettings = {
  handled: boolean;
  autoCreate: boolean;
  records: DemoRecord[];
};
export function pristineWelcome(scripts: Script[], settings: WelcomeSettings) {
  return scripts.find(
    (script) =>
      !script.deletedAt &&
      settings.records.some(
        (record) =>
          record.id === script.scriptId &&
          record.title === script.title &&
          record.body === script.body,
      ),
  );
}
export function createWelcome(locale: Locale, id = crypto.randomUUID()) {
  return { ...createScript("Welcome", welcomeBodies[locale]), scriptId: id };
}
/** Existing workspace hints disqualify a browser even if its database was removed separately. */
export function hasWorkspaceHistory() {
  try {
    return Object.keys(localStorage).some(
      (key) =>
        ["teleo.selectedScript", "teleo.lastReadScript"].includes(key) ||
        key.startsWith("teleo.position.") ||
        key.startsWith("teleo.recovery."),
    );
  } catch {
    return true;
  } // Cannot prove first use: fail closed, manual restoration stays available.
}
