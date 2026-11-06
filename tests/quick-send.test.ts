import { describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { createScript, exportBundle } from "../packages/protocol/domain";
import {
  QUICK_SEND_LIMIT,
  quickSendBodyIssue,
  validQuickSend,
  validQuickSendAck,
} from "../packages/protocol/quick-send";
import { readQuickSendFile } from "../apps/web/src/quick-send";
import { storage } from "../apps/web/src/storage";
import { dictionaries } from "../apps/web/src/i18n";
const body = "Привіт 👋\n\nДругий абзац\nТретій рядок";
const message = {
  type: "quickSend",
  id: crypto.randomUUID(),
  destination: "session",
  body,
};
describe("Quick Send boundaries", () => {
  it("preserves Unicode and paragraphs, validates destinations and frame budget", () => {
    expect(validQuickSend(message)).toBe(true);
    expect(validQuickSend({ ...message, destination: "library" })).toBe(true);
    for (const patch of [
      { body: " " },
      { body: "a".repeat(QUICK_SEND_LIMIT + 1) },
      { body: "\u0000" },
      { destination: "inbox" },
      { id: "bad" },
      { extra: true },
    ])
      expect(validQuickSend({ ...message, ...patch })).toBe(false);
    expect(
      JSON.stringify({ ...message, body: "\u0001".repeat(QUICK_SEND_LIMIT) })
        .length,
    ).toBeLessThan(52_000);
    expect(
      validQuickSendAck({
        type: "quickSendAck",
        id: message.id,
        result: "delivered",
      }),
    ).toBe(true);
    expect(
      validQuickSendAck({
        type: "quickSendAck",
        id: message.id,
        result: "applied",
      }),
    ).toBe(false);
  });
  it("explains exactly why text cannot be sent, including the 8000-character boundary", () => {
    expect(quickSendBodyIssue(" \n")).toBe("empty");
    expect(quickSendBodyIssue("a".repeat(QUICK_SEND_LIMIT))).toBeNull();
    expect(quickSendBodyIssue("a".repeat(QUICK_SEND_LIMIT + 1))).toBe(
      "tooLong",
    );
    expect(quickSendBodyIssue("Text\u0000hidden")).toBe("invalid");
    expect(quickSendBodyIssue("Привіт 👋\n\nNew paragraph")).toBeNull();
  });
  it("imports existing TXT and portable JSON formats without flattening paragraphs", async () => {
    expect(await readQuickSendFile(new File([body], "script.txt"))).toBe(body);
    expect(
      await readQuickSendFile(
        new File([exportBundle([createScript("Title", body)])], "script.json"),
      ),
    ).toBe(body);
    for (const file of [
      new File(["{}"], "bad.json"),
      new File([body], "bad.pdf"),
      new File(["a".repeat(48_001)], "big.txt"),
      new File([new Uint8Array([0xff])], "bad.txt"),
      new File([""], "empty.txt"),
    ])
      await expect(readQuickSendFile(file)).rejects.toThrow();
  });
  it("preserves valid Unicode replacement characters while rejecting malformed UTF-8", async () => {
    expect(
      await readQuickSendFile(new File(["Text � 👋"], "unicode.txt")),
    ).toBe("Text � 👋");
    await expect(
      readQuickSendFile(new File([new Uint8Array([0xff])], "bad.txt")),
    ).rejects.toThrow();
  });
  it("commits a separate script exactly once across concurrent retries, preserving later edits", async () => {
    const existing = createScript("Active", "Keep me");
    await storage.save(existing);
    await expect(
      storage.receiveScript({ ...existing, body: "Collision" }),
    ).rejects.toThrow("saveConflict");
    const received = { ...createScript("Phone", body), scriptId: message.id };
    await Promise.all([
      storage.receiveScript(received),
      storage.receiveScript(received),
    ]);
    const saved = (await storage.list()).find(
      (s) => s.scriptId === received.scriptId,
    )!;
    await storage.save({ ...saved, body: "Edited on computer" });
    expect((await storage.receiveScript(received)).body).toBe(
      "Edited on computer",
    );
    const list = await storage.list();
    expect(list.filter((s) => s.scriptId === received.scriptId)).toHaveLength(
      1,
    );
    expect(list.find((s) => s.scriptId === existing.scriptId)?.body).toBe(
      "Keep me",
    );
  });
  it("propagates transaction aborts, leaves no partial script and permits retry", async () => {
    const received = createScript("Aborted", "Retry after an aborted write");
    const add = IDBObjectStore.prototype.add;
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "add")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        const request = add.call(this, value, key);
        this.transaction.abort();
        return request;
      });
    try {
      await expect(storage.receiveScript(received)).rejects.toThrow();
    } finally {
      failure.mockRestore();
    }
    expect(
      (await storage.list()).some((s) => s.scriptId === received.scriptId),
    ).toBe(false);
    await expect(storage.receiveScript(received)).resolves.toMatchObject({
      scriptId: received.scriptId,
    });
  });
  it.each(["en", "uk", "ru"] as const)(
    "provides all Quick Send copy in %s",
    (locale) => {
      for (const key of Object.keys(dictionaries.en).filter((key) =>
        key.startsWith("quickSend"),
      ))
        expect(
          dictionaries[locale][key as keyof typeof dictionaries.en],
        ).toBeTruthy();
    },
  );
});
