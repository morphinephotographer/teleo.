import { parseBundle } from "../../../packages/protocol/domain";
import { QUICK_SEND_LIMIT } from "../../../packages/protocol/quick-send";
export async function readQuickSendFile(file: File) {
  if (file.size > 48_000 || !/\.(txt|json)$/i.test(file.name))
    throw Error("invalidImport");
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(
    await file.arrayBuffer(),
  );
  const body = /\.json$/i.test(file.name)
    ? parseBundle(raw)
        .map((s) => s.body)
        .join("\n\n")
    : raw;
  if (!body.trim() || body.length > QUICK_SEND_LIMIT || body.includes("\u0000"))
    throw Error("invalidImport");
  return body;
}
