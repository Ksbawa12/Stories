const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { Document, Paragraph, TextRun, Packer } = require('docx');

const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'Chapter 1 The Glass Divider.docx');
const outputDir = path.join(root, 'The Glass Divide');

const CHAPTER_TITLES = [
  'Chapter 1: The Glass Divider',
  'Chapter 2: The Table of Transparency',
  'Chapter 3: The Winter Solstice of Skin',
  'Chapter 4: The Architecture of Honesty',
  'Chapter 5: The Pulse of Presence',
  'Chapter 6: The Festival of Form',
  'Chapter 7: The Fractured Reflection',
  'Chapter 8: The Roots of the Aetheria',
];

function textToParagraphs(text) {
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\n+/).map((block) => {
    const line = block.trim();
    if (!line) return new Paragraph({ children: [new TextRun({ text: ' ' })] });
    return new Paragraph({
      children: [new TextRun({ text: line })],
    });
  });
}

async function main() {
  const { value } = await mammoth.extractRawText({ path: inputPath });
  const fullText = value;

  // Find start index of each chapter by its full title
  const starts = [];
  for (const title of CHAPTER_TITLES) {
    const idx = fullText.indexOf(title);
    if (idx !== -1) starts.push(idx);
  }
  starts.sort((a, b) => a - b);
  if (starts.length !== 8) {
    throw new Error('Could not find all 8 chapter titles. Found: ' + starts.length);
  }
  const boundaries = [...starts, fullText.length];
  const chapters = [];
  for (let i = 0; i < 8; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1] || fullText.length;
    let chunk = fullText.slice(start, end).trim();
    // Ensure first line is the chapter title
    const title = CHAPTER_TITLES[i];
    if (!chunk.startsWith(title)) chunk = title + '\n\n' + chunk;
    chapters.push({ title, body: chunk });
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < chapters.length; i++) {
    const { title, body } = chapters[i];
    const bodyOnly = body.startsWith(title) ? body.slice(title.length).trim() : body;
    const paras = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true })],
        heading: 'HEADING_1',
      }),
      new Paragraph({ children: [new TextRun({ text: ' ' })] }),
      ...textToParagraphs(bodyOnly),
    ];
    const doc = new Document({
      sections: [{ children: paras }],
    });
    const buffer = await Packer.toBuffer(doc);
    const safeName = title.replace(/:\s*/, ' ').trim() + '.docx';
    const outPath = path.join(outputDir, safeName);
    fs.writeFileSync(outPath, buffer);
    console.log('Wrote', outPath);
  }
  console.log('Done. Created 8 chapters in', outputDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
