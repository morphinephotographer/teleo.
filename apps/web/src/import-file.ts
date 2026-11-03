import {
  DocxError,
  docxToText,
  isLegacyWord,
  isZip,
} from "../../../packages/protocol/docx";

/** File types the import buttons offer (old .doc is offered to explain it). */
export const IMPORT_ACCEPT = [
  ".txt",
  ".md",
  ".docx",
  ".doc",
  ".json",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
].join(",");

export class ImportFileError extends Error {
  constructor(public key: "invalidImport" | "importOldWord") {
    super(key);
  }
}

/** Title from a file name: the name without its extension. */
export function importTitle(name: string) {
  return name.replace(/\.(txt|md|docx?|json)$/i, "") || name;
}

/**
 * Reads a text-like file: plain text (UTF-8) or a Word .docx document.
 * JSON bundles are handled by the caller.
 */
export async function readTextFile(file: File, maxBytes = 10_000_000) {
  if (file.size > maxBytes) throw new ImportFileError("invalidImport");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isLegacyWord(bytes)) throw new ImportFileError("importOldWord");
  if (/\.docx$/i.test(file.name) || isZip(bytes)) {
    try {
      const text = await docxToText(bytes);
      if (!text.trim()) throw new ImportFileError("invalidImport");
      return text;
    } catch (error) {
      if (error instanceof ImportFileError) throw error;
      if (error instanceof DocxError)
        throw new ImportFileError("invalidImport");
      throw new ImportFileError("invalidImport");
    }
  }
  if (/\.doc$/i.test(file.name)) throw new ImportFileError("importOldWord");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ImportFileError("invalidImport");
  }
}
