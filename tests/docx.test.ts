import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DocxError,
  docxToText,
  documentXmlToText,
  isLegacyWord,
} from "../packages/protocol/docx";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/docx/${name}`));

const expected = [
  "Вступление",
  "Добрый вечер! Сегодня мы покажем teleo. — суфлёр, который слушает голос.",
  "Первая строка\nвторая строка после переноса",
  'Символы: <тег> & "кавычки"\tпосле табуляции',
  "Перескок голосом",
  "Подсветка прочитанного",
  "Ячейка А",
  "Ячейка Б",
  "До разрыва страницы",
  "После разрыва страницы",
  "Спасибо! [пауза]",
].join("\n\n");

describe("Word import", () => {
  it("reads a .docx written by Word-compatible software", async () => {
    expect(await docxToText(fixture("script.docx"))).toBe(expected);
  });

  it("reads a .docx saved by LibreOffice", async () => {
    expect(await docxToText(fixture("script-libreoffice.docx"))).toBe(expected);
  });

  it("recognises old binary .doc files", async () => {
    expect(isLegacyWord(fixture("script.doc"))).toBe(true);
    await expect(docxToText(fixture("script.doc"))).rejects.toThrow(DocxError);
  });

  it("rejects files that are not Word documents", async () => {
    await expect(
      docxToText(new TextEncoder().encode("just text")),
    ).rejects.toThrow(DocxError);
  });

  it("drops field codes, deleted text, tab stops and duplicate renderings", () => {
    const xml = `<w:document><w:body>
      <w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>
        <w:r><w:t xml:space="preserve">Visit </w:t></w:r>
        <w:r><w:instrText> HYPERLINK "https://teleo.cc" </w:instrText></w:r>
        <w:r><w:t>teleo.cc</w:t></w:r>
        <w:del><w:r><w:delText>old words</w:delText></w:r></w:del>
        <w:ins><w:r><w:t xml:space="preserve"> today</w:t></w:r></w:ins>
      </w:p>
      <w:p><mc:AlternateContent><mc:Choice><w:r><w:t>Box</w:t></w:r></mc:Choice>
        <mc:Fallback><w:r><w:t>Box</w:t></w:r></mc:Fallback></mc:AlternateContent></w:p>
      <w:p/>
      <w:p><w:r><w:t>A&amp;B &#x2014; &#8470;1</w:t></w:r></w:p>
    </w:body></w:document>`;
    expect(documentXmlToText(xml)).toBe(
      "Visit teleo.cc today\n\nBox\n\nA&B — №1",
    );
  });
});
