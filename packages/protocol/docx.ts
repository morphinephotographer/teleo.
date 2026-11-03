/**
 * Word (.docx) import without dependencies: a .docx file is a ZIP archive and
 * the text lives in `word/document.xml`. The archive is read here and inflated
 * with the platform's DecompressionStream ("deflate-raw"), available in every
 * current browser and in Node.
 *
 * Only the words are kept: every Word paragraph becomes a teleo. paragraph,
 * formatting, images, comments, deleted (tracked) text and field codes are
 * dropped.
 */

export class DocxError extends Error {}

/** Old binary Word files (.doc) start with the OLE compound-file signature. */
export function isLegacyWord(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
      (b, i) => bytes[i] === b,
    )
  );
}

export function isZip(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

const MAX_XML = 40_000_000;

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.length > MAX_XML) throw new DocxError("too large");
  return out;
}

/** Reads one file from a ZIP archive using its central directory. */
export async function readZipEntry(bytes: Uint8Array, name: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: signature 0x06054b50 within the last 64 KB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new DocxError("not a zip");
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50)
      throw new DocxError("bad directory");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const entry = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extra + comment;
    if (entry !== name) continue;
    if (view.getUint32(local, true) !== 0x04034b50)
      throw new DocxError("bad entry");
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) return data;
    if (method === 8) return inflateRaw(data);
    throw new DocxError("unsupported compression");
  }
  return null;
}

function decodeEntities(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi,
    (_, e: string) => {
      const named: Record<string, string> = {
        lt: "<",
        gt: ">",
        amp: "&",
        quot: '"',
        apos: "'",
      };
      if (e[0] !== "#") return named[e.toLowerCase()];
      const code = parseInt(
        e.slice(e[1] === "x" ? 2 : 1),
        e[1] === "x" ? 16 : 10,
      );
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    },
  );
}

/** Plain text from WordprocessingML (`word/document.xml`). */
export function documentXmlToText(xml: string) {
  const body = xml
    // Alternate renderings repeat the same text; keep only the main one.
    .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "")
    // Paragraph and run properties (tab stops etc.), field codes, deletions.
    .replace(/<w:(pPr|rPr|instrText|delText)\b[^>]*\/>/g, "")
    .replace(/<w:(pPr|rPr|instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, "");
  const paragraphs: string[] = [];
  let current = "";
  const token =
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr|noBreakHyphen)\b([^>]*)\/?>|<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
  for (const m of body.matchAll(token)) {
    if (m[1] !== undefined) current += decodeEntities(m[1]);
    else if (m[2] === "tab") current += "\t";
    else if (m[2] === "noBreakHyphen") current += "-";
    else if (m[2] === "br" || m[2] === "cr") {
      if (/w:type="page"/.test(m[3] || "")) {
        paragraphs.push(current);
        current = "";
      } else current += "\n";
    } else {
      paragraphs.push(current);
      current = "";
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs
    .map((p) => p.replace(/[ \t]+$/gm, "").replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim())
    .join("\n\n");
}

/** Text of a .docx file. Throws DocxError for anything that is not one. */
export async function docxToText(bytes: Uint8Array) {
  if (isLegacyWord(bytes)) throw new DocxError("legacy");
  if (!isZip(bytes)) throw new DocxError("not a zip");
  const xml = await readZipEntry(bytes, "word/document.xml");
  if (!xml) throw new DocxError("no document");
  return documentXmlToText(new TextDecoder().decode(xml));
}
