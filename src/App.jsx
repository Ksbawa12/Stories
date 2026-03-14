import { useState, useEffect, useCallback } from 'react';
import content from './content.json';

const THEME_KEY = 'naked-stories-theme';
const LAST_READ_KEY = 'naked-stories-last';
const FONT_SIZE_KEY = 'naked-stories-font-size';

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

function getReadingMinutes(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

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

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (_) {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) return 'dark';
  return 'light';
}

function getInitialFontSize() {
  try {
    const s = localStorage.getItem(FONT_SIZE_KEY);
    if (s === 'small' || s === 'medium' || s === 'large') return s;
  } catch (_) {}
  return 'medium';
}

function getLastRead() {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const { storyId, chapterId } = JSON.parse(raw);
    const story = stories.find((s) => s.id === storyId);
    if (!story) return null;
    const chapter = story.chapters?.find((c) => c.id === chapterId);
    if (!chapter) return null;
    return { storyId, chapterId };
  } catch (_) {}
  return null;
}

function parseHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const pipe = hash.indexOf('|');
  if (pipe > 0) {
    const storyId = decodeURIComponent(hash.slice(0, pipe));
    const chapterId = decodeURIComponent(hash.slice(pipe + 1));
    if (storyId && chapterId) return { storyId, chapterId };
  }
  return null;
}

export default function App() {
  const [storyId, setStoryId] = useState(null);
  const [chapterId, setChapterId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [fontSize, setFontSize] = useState(getInitialFontSize);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const story = stories.find((s) => s.id === storyId) || stories[0];
  const chapter = story?.chapters?.find((c) => c.id === chapterId) || story?.chapters?.[0];
  const chapterIndex = story?.chapters?.findIndex((c) => c.id === chapterId) ?? 0;
  const totalChapters = story?.chapters?.length ?? 0;
  const prevChapter = story?.chapters?.[chapterIndex - 1];
  const nextChapter = story?.chapters?.[chapterIndex + 1];
  const progressPct = totalChapters ? (100 * (chapterIndex + 1)) / totalChapters : 0;

  const goTo = useCallback((sid, cid) => {
    setStoryId(sid);
    setChapterId(cid);
    const hash = '#' + encodeURIComponent(sid) + '|' + encodeURIComponent(cid);
    window.history.replaceState(null, '', hash);
    try {
      localStorage.setItem(LAST_READ_KEY, JSON.stringify({ storyId: sid, chapterId: cid }));
    } catch (_) {}
  }, []);

  useEffect(() => {
    const fromHash = parseHash();
    const fromLast = getLastRead();
    if (fromHash) {
      const s = stories.find((x) => x.id === fromHash.storyId);
      const c = s?.chapters?.find((x) => x.id === fromHash.chapterId);
      if (s && c) {
        setStoryId(fromHash.storyId);
        setChapterId(fromHash.chapterId);
        return;
      }
    }
    if (fromLast) {
      setStoryId(fromLast.storyId);
      setChapterId(fromLast.chapterId);
      return;
    }
    setStoryId(stories[0]?.id ?? null);
    setChapterId(stories[0]?.chapters?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (storyId && chapterId) {
      const hash = '#' + encodeURIComponent(storyId) + '|' + encodeURIComponent(chapterId);
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }
  }, [storyId, chapterId]);

  const pickStory = (id) => {
    const s = stories.find((x) => x.id === id);
    const cid = s?.chapters?.[0]?.id ?? null;
    goTo(id, cid);
  };

  const pickChapter = (id) => {
    goTo(storyId, id);
    setSidebarOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    try { localStorage.setItem(FONT_SIZE_KEY, fontSize); } catch (_) {}
  }, [fontSize]);

  useEffect(() => {
    if (sidebarOpen) document.body.classList.add('menu-open');
    else document.body.classList.remove('menu-open');
    return () => document.body.classList.remove('menu-open');
  }, [sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (helpOpen) {
        if (e.key === 'Escape') setHelpOpen(false);
        return;
      }
      if (e.target.closest('input, textarea') || e.target.isContentEditable) return;
      if (e.key === 'm' || e.key === 'M') {
        setSidebarOpen((o) => !o);
        e.preventDefault();
        return;
      }
      if (e.key === '?') {
        setHelpOpen(true);
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        if (prevChapter) {
          goTo(storyId, prevChapter.id);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') {
        if (nextChapter) {
          goTo(storyId, nextChapter.id);
          e.preventDefault();
        }
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, prevChapter, nextChapter, storyId, goTo]);

  const copyLink = () => {
    const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(storyId) + '|' + encodeURIComponent(chapterId);
    navigator.clipboard?.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const searchLower = search.trim().toLowerCase();
  const filteredStories = searchLower
    ? stories
        .map((s) => ({
          ...s,
          chapters: s.chapters.filter(
            (ch) =>
              s.title.toLowerCase().includes(searchLower) ||
              (ch.title && ch.title.toLowerCase().includes(searchLower))
          ),
        }))
        .filter((s) => s.chapters.length > 0)
    : stories;

  return (
    <>
      <nav className="navbar">
        <button
          type="button"
          className="navbar-toggle"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="navbar-brand">Naked Stories</span>
        <button
          type="button"
          className="theme-toggle"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="help-toggle"
          aria-label="Keyboard shortcuts"
          onClick={() => setHelpOpen(true)}
          title="Shortcuts (?)"
        >
          ?
        </button>
      </nav>

      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)} aria-hidden>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shortcuts">
            <div className="modal-header">
              <h2 className="modal-title">Shortcuts</h2>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setHelpOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <ul className="shortcuts-list">
                <li><kbd>M</kbd> Toggle menu</li>
                <li><kbd>←</kbd> <kbd>J</kbd> Previous chapter</li>
                <li><kbd>→</kbd> <kbd>K</kbd> Next chapter</li>
                <li><kbd>?</kbd> This help</li>
              </ul>
              <p className="modal-about">Naked Stories — Read your stories. Progress is saved; use the link to return to a chapter.</p>
            </div>
          </div>
        </div>
      )}

      <div
        className={'sidebar-overlay' + (sidebarOpen ? ' sidebar-overlay-open' : '')}
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="app-body">
        <aside className={'sidebar' + (sidebarOpen ? ' sidebar-open' : '')}>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
          <header className="sidebar-header">
            <h1 className="book-title">{story?.title ?? 'Stories'}</h1>
            <p className="book-subtitle">{story?.subtitle ?? 'Chapters'}</p>
          </header>
          <div className="search-wrap">
            <input
              type="search"
              className="search-input"
              placeholder="Search stories & chapters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search"
            />
          </div>
          <p className="toc-section-title">Stories</p>
          <nav className="story-list">
            {filteredStories.map((s) => (
              <button
                key={s.id}
                type="button"
                className={'story-link' + (s.id === storyId ? ' active' : '')}
                onClick={() => pickStory(s.id)}
              >
                {s.title}
              </button>
            ))}
            {filteredStories.length === 0 && <span className="search-empty">No matches</span>}
          </nav>
          <p className="toc-section-title">Chapters</p>
          <nav className="toc">
            {(searchLower ? story?.chapters?.filter((ch) => ch.title?.toLowerCase().includes(searchLower)) : story?.chapters)?.map((ch) => (
              <div key={ch.id} className="toc-section">
                <button
                  type="button"
                  className={'toc-link' + (ch.id === chapterId ? ' active' : '')}
                  onClick={() => pickChapter(ch.id)}
                >
                  {ch.title.length > 50 ? ch.title.slice(0, 50) + '…' : ch.title}
                </button>
              </div>
            )) ?? null}
          </nav>
        </aside>
        <main className={'reader reader-font-' + fontSize}>
          {chapter ? (
            <article className="chapter">
              <div className="reader-toolbar">
                <div className="breadcrumb">
                  <button type="button" className="breadcrumb-story" onClick={() => setSidebarOpen(true)}>{story?.title}</button>
                  <span className="breadcrumb-sep">›</span>
                  <span className="breadcrumb-chapter">{chapter.title}</span>
                </div>
                <div className="reader-meta">
                  <span className="progress-text">Chapter {chapterIndex + 1} of {totalChapters}</span>
                  <span className="reading-time">~{getReadingMinutes(chapter.body)} min read</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="reader-actions">
                  <div className="font-size-buttons">
                    <button type="button" className={fontSize === 'small' ? 'active' : ''} onClick={() => setFontSize('small')} title="Small text">A</button>
                    <button type="button" className={fontSize === 'medium' ? 'active' : ''} onClick={() => setFontSize('medium')} title="Medium text">A</button>
                    <button type="button" className={fontSize === 'large' ? 'active' : ''} onClick={() => setFontSize('large')} title="Large text">A</button>
                  </div>
                  <button type="button" className="copy-link-btn" onClick={copyLink} title="Copy link to this chapter">
                    {copyFeedback ? 'Copied!' : 'Copy link'}
                  </button>
                  <div className="prev-next">
                    <button type="button" className="prev-next-btn" disabled={!prevChapter} onClick={() => prevChapter && goTo(storyId, prevChapter.id)} title="Previous chapter (← or J)">← Prev</button>
                    <button type="button" className="prev-next-btn" disabled={!nextChapter} onClick={() => nextChapter && goTo(storyId, nextChapter.id)} title="Next chapter (→ or K)">Next →</button>
                  </div>
                </div>
              </div>
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
