import { it, expect } from "vitest";
import {
  PreviewReceiver,
  snapshot,
  validPreviewPayload,
  paragraphs,
  PREVIEW_CHUNK,
  type PreviewEnvelope,
} from "../packages/protocol/preview";
import { createScript } from "../packages/protocol/domain";
const sessionId = "a".repeat(64),
  meta = {
    id: crypto.randomUUID(),
    revision: "b".repeat(64),
    title: "Private title",
  };
const chunk = (
  sequence = 1,
  patch: Record<string, unknown> = {},
): PreviewEnvelope =>
  ({
    type: "previewContent",
    version: 1,
    epoch: 1,
    script: meta,
    index: 0,
    total: 1,
    text: "Private words",
    sessionId,
    sequence,
    ...patch,
  }) as PreviewEnvelope;
const permission = (r: PreviewReceiver, allowed = true, epoch = 1) =>
  r.permission({
    type: "previewPermission",
    version: 1,
    allowed,
    epoch,
    sessionId,
  });
it("rejects private text by default and clears text, title and partial chunks on revocation", () => {
  const r = new PreviewReceiver();
  expect(r.receive(chunk())).toBe(false);
  permission(r);
  r.receive(chunk());
  expect(r.body).toBe("Private words");
  permission(r, false, 2);
  expect(r.body).toBe("");
  expect(r.script).toBeNull();
  expect(r.receive(chunk(2))).toBe(false);
});
it("accepts only matching session, permission epoch and increasing relay sequence", () => {
  const r = new PreviewReceiver();
  permission(r);
  r.receive(chunk(5));
  expect(r.receive(chunk(4, { text: "stale" }))).toBe(false);
  expect(r.receive(chunk(6, { epoch: 0 }))).toBe(false);
  expect(r.receive(chunk(6, { sessionId: "c".repeat(64) }))).toBe(false);
  expect(r.body).toBe("Private words");
});
it("assembles bounded snapshots and never mixes script revisions", () => {
  const r = new PreviewReceiver();
  permission(r);
  r.receive(chunk(1, { total: 2, text: "first " }));
  expect(r.body).toBe("");
  r.receive(chunk(2, { index: 1, total: 2, text: "second" }));
  expect(r.body).toBe("first second");
  r.receive(
    chunk(3, {
      script: { ...meta, revision: "c".repeat(64) },
      text: "new version",
    }),
  );
  expect(r.body).toBe("new version");
  expect(r.receive(chunk(4, { index: 1, total: 2, text: "old tail" }))).toBe(
    false,
  );
  expect(r.body).toBe("new version");
});
it("a new session resets ordering but stale permissions cannot revive revoked content", () => {
  const r = new PreviewReceiver();
  permission(r);
  r.receive(chunk(90));
  permission(r, false, 2);
  permission(r, true, 1);
  expect(r.allowed).toBe(false);
  r.permission({
    type: "previewPermission",
    version: 1,
    allowed: true,
    epoch: 1,
    sessionId: "d".repeat(64),
  });
  expect(r.receive(chunk(1, { sessionId: "d".repeat(64) }))).toBe(true);
});
it("validates exact shapes, versions, chunk bounds, numeric positions and content limits", () => {
  const m = { ...chunk() } as Record<string, unknown>;
  delete m.sequence;
  delete m.sessionId;
  expect(validPreviewPayload(m)).toBe(true);
  expect(
    validPreviewPayload({ ...m, text: "x".repeat(PREVIEW_CHUNK + 1) }),
  ).toBe(false);
  expect(validPreviewPayload({ ...m, version: 2 })).toBe(false);
  expect(validPreviewPayload({ ...m, total: 257 })).toBe(false);
  expect(validPreviewPayload({ ...m, index: 3 })).toBe(false);
  expect(validPreviewPayload({ ...m, extra: "secret" })).toBe(false);
});
it("content revision changes with edits or script identity; paragraph offsets preserve Unicode", async () => {
  const a = createScript("Title", "Hello 🌍\n\nПривіт\n\nمرحبا");
  const snap = await snapshot(a);
  expect(
    (await snapshot({ ...a, body: a.body + "!" }))!.script.revision,
  ).not.toBe(snap!.script.revision);
  expect(
    (await snapshot({ ...a, scriptId: crypto.randomUUID() }))!.script.revision,
  ).not.toBe(snap!.script.revision);
  for (const p of paragraphs(a.body))
    expect(a.body.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
});
it("authoritative position has multiplier units and rejects stale state or invalid speed", () => {
  const r = new PreviewReceiver();
  permission(r);
  r.receive(chunk());
  const position = {
    type: "previewPosition",
    version: 1,
    epoch: 1,
    script: { id: meta.id, revision: meta.revision },
    state: { playing: true, speed: 1.25, position: 320 },
    speedUnit: "multiplier",
    offset: 5,
    paragraph: 1,
    timestamp: Date.now(),
    sessionId,
    sequence: 3,
  } as const;
  expect(r.receive(position)).toBe(true);
  expect(r.position?.paragraph).toBe(1);
  expect(r.receive({ ...position, sequence: 2, paragraph: 0 })).toBe(false);
  expect(r.position?.paragraph).toBe(1);
  const payload = { ...position } as Record<string, unknown>;
  delete payload.sequence;
  delete payload.sessionId;
  expect(validPreviewPayload({ ...payload, speedUnit: "wpm" })).toBe(false);
  expect(
    validPreviewPayload({
      ...payload,
      state: { playing: true, speed: 4, position: 0 },
    }),
  ).toBe(false);
});
it("oversized or pathological paragraph snapshots are declined without retaining private data", async () => {
  expect(
    await snapshot(createScript("large", "x".repeat(8192 * 256 + 1))),
  ).toBeNull();
  expect(await snapshot(createScript("many", "p\n\n".repeat(5001)))).toBeNull();
  const r = new PreviewReceiver();
  permission(r);
  r.receive(chunk());
  expect(
    r.receive({
      type: "previewUnavailable",
      version: 1,
      epoch: 1,
      reason: "tooLarge",
      sessionId,
      sequence: 2,
    }),
  ).toBe(true);
  expect(r.script).toBeNull();
  expect(r.body).toBe("");
  expect(r.unavailable).toBe(true);
});
