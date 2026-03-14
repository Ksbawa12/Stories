import { useState } from 'react';
import content from './content.json';

// Normalize content once at load
function flattenChapters(chapters) {
  const out = [];
  (chapters || []).forEach((ch) => {
    if (ch.children) out.push(...ch.children);
    else out.push(ch);
  });
  return out;
}

const stories = (content.stories || []).map((s) => ({
  id: s.id || String(s.title).toLowerCase().replace(/\s+/g, '-'),
  title: s.title,
  subtitle: s.subtitle || '',
  chapters: flattenChapters(s.chapters),
}));

function ChapterBody({ body }) {
  if (!body || !body.trim()) return null;
  const paras = body.split(/\n\n+/).filter((p) => p.trim());
  return (
    <div className="chapter-body">
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export default function App() {
  const [storyId, setStoryId] = useState(stories[0]?.id ?? null);
  const [chapterId, setChapterId] = useState(stories[0]?.chapters?.[0]?.id ?? null);

  const story = stories.find((s) => s.id === storyId) || stories[0];
  const chapter = story?.chapters?.find((c) => c.id === chapterId) || story?.chapters?.[0];

  const pickStory = (id) => {
    setStoryId(id);
    const s = stories.find((x) => x.id === id);
    setChapterId(s?.chapters?.[0]?.id ?? null);
  };

  const pickChapter = (id) => {
    setChapterId(id);
  };

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">Naked Stories</span>
      </nav>
      <div className="app-body">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="book-title">{story?.title ?? 'Stories'}</h1>
          <p className="book-subtitle">{story?.subtitle ?? 'Chapters'}</p>
        </header>
        <p className="toc-section-title">Stories</p>
        <nav className="story-list">
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'story-link' + (s.id === storyId ? ' active' : '')}
              onClick={() => pickStory(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
        <p className="toc-section-title">Chapters</p>
        <nav className="toc">
          {story?.chapters?.map((ch) => (
            <div key={ch.id} className="toc-section">
              <button
                type="button"
                className={'toc-link' + (ch.id === chapterId ? ' active' : '')}
                onClick={() => pickChapter(ch.id)}
              >
                {ch.title.length > 50 ? ch.title.slice(0, 50) + '…' : ch.title}
              </button>
            </div>
          ))}
        </nav>
      </aside>
      <main className="reader">
        {chapter ? (
          <article className="chapter">
            <h2 className="chapter-title">{chapter.title}</h2>
            <ChapterBody body={chapter.body} />
          </article>
        ) : (
          <p className="chapter-placeholder">Select a story and chapter.</p>
        )}
      </main>
      </div>
    </>
  );
}
