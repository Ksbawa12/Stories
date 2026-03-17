import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'app');
const publicDir = path.join(root, 'public');
const contentPath = path.join(publicDir, 'content.json');
const legacyContentPath = path.join(appDir, 'content.json');

const FOLDERS = [
  { id: 'the-glass-divide', dir: 'The Glass Divide', title: 'The Glass Divide', subtitle: 'A mirror between two worlds', chapterPrefix: 'glass' },
  { id: 'naked-festival', dir: 'Naked Festival', title: 'Naked Festival', subtitle: 'The Spirit of Suvarnaloka', chapterPrefix: 'festival' },
  { id: 'naked-family', dir: 'Naked Family', title: 'Naked Family', subtitle: '', chapterPrefix: 'family' },
  { id: 'the-3-day-kingdom', dir: 'The 3-Day Kingdom', title: 'The 3-Day Kingdom', subtitle: '', chapterPrefix: 'kingdom' },
  { id: 'the-only-one-who-remembers', dir: 'The Only One Who Remembers', title: 'The Only One Who Remembers', subtitle: '', chapterPrefix: 'onlyone' },
  { id: 'the-source-and-the-sapling', dir: 'The Source and the Sapling', title: 'The Source and the Sapling', subtitle: '', chapterPrefix: 'sapling' },
  { id: 'the-bare-surprise', dir: 'The Bare Surprise', title: 'The Bare Surprise', subtitle: '', chapterPrefix: 'bare' },
  { id: 'the-second-skin', dir: 'The Second Skin', title: 'The Second Skin', subtitle: '', chapterPrefix: 'skin' },
  { id: 'the-naked-haveli', dir: 'The Naked Haveli', title: 'The Naked Haveli', subtitle: '', chapterPrefix: 'haveli' },
  { id: 'the-silk-horizon', dir: 'The Silk Horizon', title: 'The Silk Horizon', subtitle: '', chapterPrefix: 'silk' },
];

function htmlToPlain(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocx(filePath) {
  const buf = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer: buf });
  return htmlToPlain(result.value);
}

async function extractPdf(filePath) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    const text = (result && result.text) ? String(result.text) : '';
    return text.replace(/\n{3,}/g, '\n\n').replace(/\r\n/g, '\n').trim();
  } finally {
    await parser.destroy();
  }
}

function flattenChapters(chapters) {
  const out = [];
  (chapters || []).forEach((ch) => {
    if (ch.children) out.push(...ch.children);
    else out.push(ch);
  });
  return out;
}

function loadExistingStories() {
  let json;
  const pathToRead = fs.existsSync(contentPath) ? contentPath : legacyContentPath;
  try {
    json = JSON.parse(fs.readFileSync(pathToRead, 'utf8'));
  } catch (e) {
    return [];
  }
  const stories = [];
  if (json.stories && Array.isArray(json.stories)) {
    return json.stories;
  }
  if (json.chapters && Array.isArray(json.chapters)) {
    const festivalChapters = json.chapters.filter((ch) => !ch.children);
    stories.push({
      id: 'naked-festival',
      title: json.title || 'Naked Festival',
      subtitle: json.subtitle || '',
      chapters: festivalChapters
    });
    const familyBlock = json.chapters.find(
      (ch) => ch.children && (ch.id === '_family' || (ch.title && ch.title.includes('Naked Family')))
    );
    if (familyBlock && familyBlock.children) {
      stories.push({
        id: 'naked-family',
        title: familyBlock.title.replace(/\s*\(Extended\)\s*/i, '').trim() || 'Naked Family',
        subtitle: '',
        chapters: familyBlock.children
      });
    }
  }
  return stories;
}

async function main() {
  const stories = loadExistingStories().filter((s) => s && s.id !== 'family-kamasutra' && s.id !== 'moms-help-with-erection' && s.id !== 'untitled-folder');

  for (const { id, dir, title, subtitle, chapterPrefix } of FOLDERS) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) {
      console.warn('Folder not found:', dirPath);
      // If it existed in the previous content.json, remove it so deleted folders disappear from the app.
      const idx = stories.findIndex((s) => s.id === id);
      if (idx >= 0) stories.splice(idx, 1);
      continue;
    }
    const files = fs.readdirSync(dirPath)
      .filter((n) => !n.startsWith('~') && (n.toLowerCase().endsWith('.docx') || n.toLowerCase().endsWith('.pdf')))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const chapters = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(dirPath, file);
      const isPdf = file.toLowerCase().endsWith('.pdf');
      const chapterTitle = file.replace(/\.(docx|pdf)$/i, '').trim();
      const prefix = chapterPrefix || id.split('-').pop() || 'ch';
      const chapterId = prefix + '-' + (i + 1);
      let body = '';
      try {
        body = isPdf ? await extractPdf(filePath) : await extractDocx(filePath);
      } catch (err) {
        console.warn('Extract failed for', file, err.message);
      }
      chapters.push({ id: chapterId, title: chapterTitle, body: body || '(No text extracted.)' });
    }

    // If filenames include "Part N", group into Part 1..6 blocks.
    const hasPart = chapters.some((ch) => /^Part\s+\d+\b/i.test(ch.title));
    let chapterOutput = chapters;
    if (hasPart) {
      const parts = new Map();
      for (let p = 1; p <= 6; p++) parts.set(p, []);
      for (const ch of chapters) {
        const m = String(ch.title).match(/^Part\s+(\d+)\s+(.*)$/i);
        const partNum = m ? Math.max(1, Math.min(6, parseInt(m[1], 10))) : 1;
        const cleanTitle = m ? m[2].trim() : ch.title;
        parts.get(partNum).push({ ...ch, title: cleanTitle });
      }
      chapterOutput = [];
      for (let p = 1; p <= 6; p++) {
        const children = parts.get(p) || [];
        if (children.length === 0) continue;
        chapterOutput.push({
          id: `${chapterPrefix || id}-part-${p}`,
          title: `Part ${p}`,
          children
        });
      }
    }

    const existing = stories.find((s) => s.id === id);
    if (existing) {
      existing.chapters = chapterOutput;
      existing.title = title;
      existing.subtitle = subtitle;
    } else {
      stories.push({ id, title, subtitle, chapters: chapterOutput });
    }
  }

  const output = { stories };
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(contentPath, JSON.stringify(output, null, 2), 'utf8');
  console.log('Wrote', contentPath);
  stories.forEach((s) => console.log('  -', s.title + ':', (s.chapters || []).length, 'chapters'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
