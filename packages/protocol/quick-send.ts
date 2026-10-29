/** Fits the existing relay frame budget even when every character is JSON-escaped. */
export const QUICK_SEND_LIMIT = 8_000;
export type QuickSend = {
  type: "quickSend";
  id: string;
  destination: "session" | "library";
  body: string;
};
export type QuickSendAck = {
  type: "quickSendAck";
  id: string;
  result: "delivered" | "saved" | "failed";
};
export const transferId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    id,
  );
export function validQuickSend(value: unknown): value is QuickSend {
  if (!value || typeof value !== "object") return false;
  const m = value as QuickSend;
  return (
    Object.keys(m).sort().join(",") === "body,destination,id,type" &&
    m.type === "quickSend" &&
    transferId(m.id) &&
    ["session", "library"].includes(m.destination) &&
    typeof m.body === "string" &&
    !!m.body.trim() &&
    m.body.length <= QUICK_SEND_LIMIT &&
    !m.body.includes("\u0000")
  );
}
export function validQuickSendAck(value: unknown): value is QuickSendAck {
  if (!value || typeof value !== "object") return false;
  const m = value as QuickSendAck;
  return (
    Object.keys(m).sort().join(",") === "id,result,type" &&
    m.type === "quickSendAck" &&
    transferId(m.id) &&
    ["delivered", "saved", "failed"].includes(m.result)
  );
}
