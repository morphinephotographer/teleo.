import { readTextFile } from "./import-file";
import { parseBundle } from "../../../packages/protocol/domain";
import { QUICK_SEND_LIMIT } from "../../../packages/protocol/quick-send";
export async function readQuickSendFile(file: File) {
  const json = /\.json$/i.test(file.name);
  // Word files carry formatting and packaging, so they may be larger.
  const word = /\.docx?$/i.test(file.name);
  if (
    file.size > (word ? 10_000_000 : 48_000) ||
    !/\.(txt|md|json|docx?)$/i.test(file.name)
  )
    throw Error("invalidImport");
  const body = json
    ? parseBundle(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        ),
      )
        .map((s) => s.body)
        .join("\n\n")
    : await readTextFile(file);
  if (!body.trim() || body.length > QUICK_SEND_LIMIT || body.includes("\u0000"))
    throw Error("invalidImport");
  return body;
}
