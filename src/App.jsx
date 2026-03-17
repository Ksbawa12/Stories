import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import content from './content.json';

const THEME_KEY = 'naked-stories-theme';
const LAST_READ_KEY = 'naked-stories-last';
const FONT_SIZE_KEY = 'naked-stories-font-size';
const LINE_SPACING_KEY = 'naked-stories-line-spacing';
const RECENT_KEY = 'naked-stories-recent';
const BOOKMARKS_KEY = 'naked-stories-bookmarks';
const STATS_KEY = 'naked-stories-stats';
const CHAPTER_PROGRESS_KEY = 'naked-stories-chapter-progress';
const WORDS_PER_PAGE = 260;
const RECENT_MAX = 5;

function flattenChapters(chapters) {
  const out = [];
  (chapters || []).forEach((ch) => {
    if (ch && Array.isArray(ch.children)) out.push(...flattenChapters(ch.children));
    else if (ch) out.push(ch);
  });
  return out;
}

const stories = (content.stories || []).map((s) => {
  const chaptersTree = Array.isArray(s.chapters) ? s.chapters : [];
  const chapters = flattenChapters(chaptersTree);
  return ({
    id: s.id || String(s.title).toLowerCase().replace(/\s+/g, '-'),
    title: s.title,
    subtitle: s.subtitle || '',
    chaptersTree,
    chapters,
  });
});

function getReadingMinutes(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Split chapter body into pages (each page ≈ WORDS_PER_PAGE). Returns array of page text. */
function paginateChapter(body) {
  if (!body || !body.trim()) return [];
  const paras = body.split(/\n\n+/).filter((p) => p.trim());
  const pages = [];
  let current = [];
  let wordCount = 0;
  for (const p of paras) {
    const words = p.trim().split(/\s+/).length;
    if (wordCount + words > WORDS_PER_PAGE && current.length > 0) {
      pages.push(current.join('\n\n'));
      current = [];
      wordCount = 0;
    }
    current.push(p.trim());
    wordCount += words;
  }
  if (current.length > 0) pages.push(current.join('\n\n'));
  return pages;
}

function looksLikeChapterTitle(paragraph) {
  const t = (paragraph || '').trim();
  return /^Chapter\s+\d+\s*[.:]/.test(t) || (t.length < 60 && /^Chapter\s+/i.test(t));
}

function ChapterBody({ body, dropCap }) {
  if (!body || !body.trim()) return null;
  const paras = body.split(/\n\n+/).filter((p) => p.trim());
  const dropCapIndex = dropCap && paras.length > 0
    ? (looksLikeChapterTitle(paras[0]) && paras.length > 1 ? 1 : 0)
    : -1;
  return (
    <div className={'chapter-body' + (dropCap ? ' chapter-body-drop-cap' : '')}>
      {paras.map((p, i) => (
        <p key={i} className={i === dropCapIndex ? 'drop-cap-letter' : ''}>{p}</p>
      ))}
    </div>
  );
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'sepia') return saved;
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
    const data = JSON.parse(raw);
    const { storyId, chapterId, pageIndex = 0 } = data;
    const story = stories.find((s) => s.id === storyId);
    if (!story) return null;
    const chapter = story.chapters?.find((c) => c.id === chapterId);
    if (!chapter) return null;
    return { storyId, chapterId, pageIndex: Math.max(0, pageIndex) };
  } catch (_) {}
  return null;
}

function parseHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const parts = hash.split('|').map((p) => decodeURIComponent(p));
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const pageIndex = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;
    return { storyId: parts[0], chapterId: parts[1], pageIndex: isNaN(pageIndex) ? 0 : Math.max(0, pageIndex) };
  }
  return null;
}

function getRecentlyOpened() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
  } catch (_) {}
  return [];
}

function addToRecentlyOpened(storyId) {
  try {
    let arr = getRecentlyOpened().filter((id) => id !== storyId);
    arr = [storyId, ...arr].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  } catch (_) {}
}

function getBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {}
  return [];
}

function addBookmark(storyId, chapterId, storyTitle, chapterTitle) {
  try {
    const list = getBookmarks().filter((b) => !(b.storyId === storyId && b.chapterId === chapterId));
    list.push({ storyId, chapterId, storyTitle, chapterTitle });
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch (_) {}
}

function removeBookmark(storyId, chapterId) {
  try {
    const list = getBookmarks().filter((b) => !(b.storyId === storyId && b.chapterId === chapterId));
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch (_) {}
}

function isBookmarked(storyId, chapterId) {
  return getBookmarks().some((b) => b.storyId === storyId && b.chapterId === chapterId);
}

function getStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { totalPages: 0 };
    const o = JSON.parse(raw);
    return { totalPages: Number(o.totalPages) || 0 };
  } catch (_) {}
  return { totalPages: 0 };
}

function recordPageTurn() {
  try {
    const s = getStats();
    localStorage.setItem(STATS_KEY, JSON.stringify({ totalPages: (s.totalPages || 0) + 1 }));
  } catch (_) {}
}

function getChapterProgress() {
  try {
    const raw = localStorage.getItem(CHAPTER_PROGRESS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === 'object' && o !== null ? o : {};
  } catch (_) {}
  return {};
}

function markChapterVisited(storyId, chapterId) {
  try {
    const progress = getChapterProgress();
    const set = new Set(progress[storyId] || []);
    set.add(chapterId);
    progress[storyId] = [...set];
    localStorage.setItem(CHAPTER_PROGRESS_KEY, JSON.stringify(progress));
  } catch (_) {}
}

function getInitialLineSpacing() {
  try {
    const s = localStorage.getItem(LINE_SPACING_KEY);
    if (s === 'tight' || s === 'normal' || s === 'relaxed') return s;
  } catch (_) {}
  return 'normal';
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
  const [bookOpen, setBookOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const [lineSpacing, setLineSpacing] = useState(getInitialLineSpacing);
  const [bookmarks, setBookmarks] = useState(getBookmarks);
  const touchStartX = useRef(0);
  const touchHandledAsTap = useRef(false);

  const story = stories.find((s) => s.id === storyId) || stories[0];
  const chapter = story?.chapters?.find((c) => c.id === chapterId) || story?.chapters?.[0];
  const chapterIndex = story?.chapters?.findIndex((c) => c.id === chapterId) ?? 0;
  const totalChapters = story?.chapters?.length ?? 0;
  const prevChapter = story?.chapters?.[chapterIndex - 1];
  const nextChapter = story?.chapters?.[chapterIndex + 1];
  const isLastChapter = !nextChapter;

  const progressPct = totalChapters ? (100 * (chapterIndex + 1)) / totalChapters : 0;

  const goTo = useCallback((sid, cid, page = 0) => {
    setStoryId(sid);
    setChapterId(cid);
    setPageIndex(Math.max(0, page));
    markChapterVisited(sid, cid);
    const hash = '#' + encodeURIComponent(sid) + '|' + encodeURIComponent(cid) + '|' + String(Math.max(0, page));
    window.history.replaceState(null, '', hash);
    try {
      localStorage.setItem(LAST_READ_KEY, JSON.stringify({ storyId: sid, chapterId: cid, pageIndex: Math.max(0, page) }));
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
        setPageIndex(fromHash.pageIndex ?? 0);
        setBookOpen(true);
        return;
      }
    }
    if (fromLast) {
      setStoryId(fromLast.storyId);
      setChapterId(fromLast.chapterId);
      setPageIndex(fromLast.pageIndex ?? 0);
      setBookOpen(true);
      return;
    }
    setStoryId(stories[0]?.id ?? null);
    setChapterId(stories[0]?.chapters?.[0]?.id ?? null);
    setPageIndex(0);
  }, []);

  useEffect(() => {
    if (storyId && chapterId) {
      const hash = '#' + encodeURIComponent(storyId) + '|' + encodeURIComponent(chapterId) + '|' + String(pageIndex);
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }
  }, [storyId, chapterId, pageIndex]);

  const pickStory = (id) => {
    const s = stories.find((x) => x.id === id);
    const cid = s?.chapters?.[0]?.id ?? null;
    goTo(id, cid, 0);
    setBookOpen(false);
  };

  const pickChapter = (id) => {
    goTo(storyId, id, 0);
    setSidebarOpen(false);
  };

  const goPrevChapter = useCallback(() => {
    if (prevChapter) {
      recordPageTurn();
      goTo(storyId, prevChapter.id, 0);
    } else {
      setBookOpen(false);
    }
  }, [storyId, prevChapter, goTo]);

  const goNextChapter = useCallback(() => {
    if (nextChapter) {
      recordPageTurn();
      goTo(storyId, nextChapter.id, 0);
    }
  }, [storyId, nextChapter, goTo]);

  const toggleTheme = () => {
    const order = ['light', 'dark', 'sepia'];
    const i = order.indexOf(theme);
    const next = order[(i + 1) % order.length];
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
    document.documentElement.setAttribute('data-line-spacing', lineSpacing);
    try { localStorage.setItem(LINE_SPACING_KEY, lineSpacing); } catch (_) {}
  }, [lineSpacing]);

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
        if (bookOpen && story) {
          goPrevChapter();
          e.preventDefault();
        } else if (prevChapter) {
          goTo(storyId, prevChapter.id, 0);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') {
        if (bookOpen && story) {
          goNextChapter();
          e.preventDefault();
        } else if (story && !bookOpen) {
          setBookOpen(true);
          e.preventDefault();
        } else if (nextChapter) {
          goTo(storyId, nextChapter.id, 0);
          e.preventDefault();
        }
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, bookOpen, story, prevChapter, nextChapter, storyId, goTo, goPrevChapter, goNextChapter]);

  const shareUrl = useMemo(() => {
    return window.location.origin + window.location.pathname + '#' + encodeURIComponent(storyId) + '|' + encodeURIComponent(chapterId) + '|' + String(pageIndex);
  }, [storyId, chapterId, pageIndex]);

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const shareChapter = () => {
    if (navigator.share) {
      navigator.share({
        title: chapter ? `${story?.title} – ${chapter.title}` : story?.title,
        url: shareUrl,
      }).then(() => setCopyFeedback(true)).catch(() => copyLink());
    } else copyLink();
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const exportChapter = () => {
    if (!chapter) return;
    const text = chapter.title + '\n\n' + (chapter.body || '').replace(/\n{3,}/g, '\n\n').trim();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (story?.title || 'chapter') + ' - ' + (chapter.title || 'export') + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleBookmark = () => {
    if (!story || !chapter) return;
    if (isBookmarked(storyId, chapterId)) {
      removeBookmark(storyId, chapterId);
    } else {
      addBookmark(storyId, chapterId, story.title, chapter.title);
    }
    setBookmarks(getBookmarks());
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches?.[0]?.clientX ?? 0; };

  /** Tap zones: left = prev chapter, right = next chapter. */
  const handleReaderTap = (e) => {
    if (e.target.closest('button')) return;
    if (!chapter) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX ?? 0) - rect.left;
    const w = rect.width;
    if (x < w * 0.33) goPrevChapter();
    else if (x > w * 0.66) goNextChapter();
  };

  const handleReaderTouchEnd = (e) => {
    const endX = e.changedTouches?.[0]?.clientX ?? 0;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) >= 50) {
      if (delta < 0) goNextChapter();
      else goPrevChapter();
    } else {
      touchHandledAsTap.current = true;
      handleReaderTap({ clientX: endX, currentTarget: e.currentTarget, target: e.target });
    }
  };

  const handleReaderClick = (e) => {
    if (touchHandledAsTap.current) {
      touchHandledAsTap.current = false;
      return;
    }
    handleReaderTap(e);
  };

  const searchLower = search.trim().toLowerCase();
  const lastRead = getLastRead();
  const recentlyOpenedIds = getRecentlyOpened();
  const recentlyOpened = recentlyOpenedIds.map((id) => stories.find((s) => s.id === id)).filter(Boolean);
  const chapterProgress = getChapterProgress();
  const visitedChapters = new Set((storyId && chapterProgress[storyId]) || []);

  const continueReading = () => {
    if (!lastRead) return;
    setHasEntered(true);
    setStoryId(lastRead.storyId);
    setChapterId(lastRead.chapterId);
    setPageIndex(lastRead.pageIndex ?? 0);
    setBookOpen(true);
    addToRecentlyOpened(lastRead.storyId);
  };

  const enterBook = (sid, options = {}) => {
    setHasEntered(true);
    const s = stories.find((x) => x.id === sid);
    if (s) {
      setStoryId(sid);
      setChapterId(options.chapterId ?? s.chapters?.[0]?.id ?? null);
      setPageIndex(options.pageIndex ?? 0);
      setBookOpen(options.openDirect ?? false);
      addToRecentlyOpened(sid);
    }
  };

  if (!hasEntered) {
    const lastReadStory = lastRead && stories.find((s) => s.id === lastRead.storyId);
    const lastReadChapter = lastReadStory?.chapters?.find((c) => c.id === lastRead.chapterId);
    return (
      <div className="home-front">
        <nav className="home-nav">
          <span className="home-nav-brand">Naked Stories</span>
          <div className="home-nav-actions">
            <button
              type="button"
              className="home-nav-btn"
              aria-label="Keyboard shortcuts"
              onClick={() => setHelpOpen(true)}
              title="Shortcuts (?)"
            >
              ?
            </button>
            <button
              type="button"
              className="home-nav-btn"
              aria-label="Cycle theme"
              onClick={toggleTheme}
              title="Theme"
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              ) : theme === 'dark' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
              ) : (
                <span className="home-theme-sepia" aria-hidden>◐</span>
              )}
            </button>
          </div>
        </nav>
        <main className="home-main">
          <header className="home-hero">
            <h1 className="home-front-title">Naked Stories</h1>
            <p className="home-front-tagline">Stories to read at your pace</p>
          </header>
          {lastRead && lastReadStory && (
            <section className="home-section home-section-anim">
              <h2 className="home-section-title">Continue reading</h2>
              <button type="button" className="home-continue-card" onClick={continueReading}>
                <span className="home-continue-title">{lastReadStory.title}</span>
                <span className="home-continue-meta">{lastReadChapter?.title ?? 'Chapter ' + (lastRead.chapterId || '')}</span>
                <span className="home-continue-cta">Continue</span>
              </button>
            </section>
          )}
          {recentlyOpened.length > 0 && (
            <section className="home-section home-books-section home-section-anim" aria-label="Recently opened">
              <h2 className="home-section-title">Recently opened</h2>
              <div className="home-books-grid home-books-grid-recent">
                {recentlyOpened.filter((s) => s.id !== lastRead?.storyId).slice(0, 4).map((s, i) => (
                  <button key={s.id} type="button" className="home-book-card home-card-anim" style={{ animationDelay: `${0.05 * i}s` }} onClick={() => enterBook(s.id)}>
                    <span className="home-book-card-title">{s.title}</span>
                    <span className="home-book-card-meta">{s.chapters?.length ?? 0} chapters</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="home-section home-books-section home-section-anim" aria-label="Stories">
            <h2 className="home-section-title">All stories</h2>
            <div className="home-books-grid">
              {stories.map((s, i) => {
                const totalMins = (s.chapters || []).reduce((sum, ch) => sum + getReadingMinutes(ch.body), 0);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="home-book-card home-card-anim"
                    style={{ animationDelay: `${0.05 * i}s` }}
                    onClick={() => enterBook(s.id)}
                    onKeyDown={(e) => e.key === 'Enter' && enterBook(s.id)}
                  >
                    <span className="home-book-card-title">{s.title}</span>
                    {s.subtitle ? <span className="home-book-card-subtitle">{s.subtitle}</span> : null}
                    <span className="home-book-card-meta">{s.chapters?.length ?? 0} chapters · ~{totalMins} min read</span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
        <footer className="home-footer">
          <p className="home-footer-text">Naked Stories — your progress is saved locally.</p>
          <p className="home-footer-meta">Use <kbd>?</kbd> for shortcuts.</p>
        </footer>
      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)} aria-hidden>
          <div className="modal modal-anim" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shortcuts">
            <div className="modal-header">
              <h2 className="modal-title">Shortcuts</h2>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setHelpOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-stats">You&apos;ve read <strong>{getStats().totalPages}</strong> pages</p>
              <ul className="shortcuts-list">
                <li><kbd>←</kbd> <kbd>J</kbd> Previous chapter</li>
                <li><kbd>→</kbd> <kbd>K</kbd> Next chapter</li>
                <li><kbd>?</kbd> This help</li>
              </ul>
              <p className="modal-about">Tap left/right to change chapter. Scroll to read.</p>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

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
          aria-label="Cycle theme"
          onClick={toggleTheme}
          title="Theme (light / dark / sepia)"
        >
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <span className="nav-theme-sepia" aria-hidden>◐</span>
          )}
        </button>
        <button
          type="button"
          className="help-toggle"
          aria-label="Keyboard shortcuts & stats"
          onClick={() => setHelpOpen(true)}
          title="Shortcuts (?)"
        >
          ?
        </button>
      </nav>

      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)} aria-hidden>
          <div className="modal modal-anim" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shortcuts">
            <div className="modal-header">
              <h2 className="modal-title">Shortcuts</h2>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setHelpOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-stats">You&apos;ve read <strong>{getStats().totalPages}</strong> pages</p>
              <ul className="shortcuts-list">
                <li><kbd>M</kbd> Toggle menu</li>
                <li><kbd>←</kbd> <kbd>J</kbd> Previous chapter</li>
                <li><kbd>→</kbd> <kbd>K</kbd> Next chapter</li>
                <li><kbd>?</kbd> This help</li>
              </ul>
              <p className="modal-about" style={{ marginTop: '0.5rem' }}>Tap left/right to change chapter. Scroll to read.</p>
              <p className="modal-about">Naked Stories — Progress is saved. Use Share to copy the link.</p>
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
          <button
            type="button"
            className="sidebar-library-link"
            onClick={() => setHasEntered(false)}
          >
            ← Library
          </button>
          {bookmarks.length > 0 && (
            <>
              <p className="toc-section-title">Bookmarks</p>
              <nav className="sidebar-bookmarks">
                {bookmarks.slice(0, 8).map((b) => (
                  <button
                    key={b.storyId + b.chapterId}
                    type="button"
                    className="toc-link sidebar-bookmark-link"
                    onClick={() => { enterBook(b.storyId, { chapterId: b.chapterId, openDirect: true }); setSidebarOpen(false); }}
                  >
                    <span className="sidebar-bookmark-title">{b.chapterTitle}</span>
                    <span className="sidebar-bookmark-story">{b.storyTitle}</span>
                  </button>
                ))}
              </nav>
            </>
          )}
          <div className="search-wrap">
            <input
              type="search"
              className="search-input"
              placeholder="Search chapters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search chapters"
            />
          </div>
          <p className="toc-section-title">Chapters</p>
          <nav className="toc">
            {searchLower ? (
              (story?.chapters || [])
                .filter((ch) => (ch.title || '').toLowerCase().includes(searchLower))
                .map((ch) => (
                  <div key={ch.id} className="toc-section">
                    <button
                      type="button"
                      className={'toc-link' + (ch.id === chapterId ? ' active' : '') + (visitedChapters.has(ch.id) ? ' visited' : '')}
                      onClick={() => pickChapter(ch.id)}
                    >
                      {visitedChapters.has(ch.id) && <span className="toc-link-dot" aria-hidden />}
                      {(ch.title || '').length > 50 ? (ch.title || '').slice(0, 50) + '…' : (ch.title || '')}
                    </button>
                  </div>
                ))
            ) : (
              (story?.chaptersTree || []).map((node) => {
                if (node && Array.isArray(node.children)) {
                  return (
                    <div key={node.id || node.title} className="toc-part-group">
                      <p className="toc-part-title">{node.title}</p>
                      {node.children.map((ch) => (
                        <div key={ch.id} className="toc-section">
                          <button
                            type="button"
                            className={'toc-link' + (ch.id === chapterId ? ' active' : '') + (visitedChapters.has(ch.id) ? ' visited' : '')}
                            onClick={() => pickChapter(ch.id)}
                          >
                            {visitedChapters.has(ch.id) && <span className="toc-link-dot" aria-hidden />}
                            {(ch.title || '').length > 50 ? (ch.title || '').slice(0, 50) + '…' : (ch.title || '')}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                }
                const ch = node;
                if (!ch) return null;
                return (
                  <div key={ch.id} className="toc-section">
                    <button
                      type="button"
                      className={'toc-link' + (ch.id === chapterId ? ' active' : '') + (visitedChapters.has(ch.id) ? ' visited' : '')}
                      onClick={() => pickChapter(ch.id)}
                    >
                      {visitedChapters.has(ch.id) && <span className="toc-link-dot" aria-hidden />}
                      {(ch.title || '').length > 50 ? (ch.title || '').slice(0, 50) + '…' : (ch.title || '')}
                    </button>
                  </div>
                );
              })
            )}
          </nav>
        </aside>
        <main className={'reader reader-font-' + fontSize + ' reader-line-' + lineSpacing + ' reader-book'}>
          {!story ? (
            <p className="chapter-placeholder">Select a story and chapter.</p>
          ) : !bookOpen ? (
            <div className="book-cover" onClick={() => setBookOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setBookOpen(true); }}>
              <div className="book-cover-inner">
                <h2 className="book-cover-title">{story.title}</h2>
                {story.subtitle ? <p className="book-cover-subtitle">{story.subtitle}</p> : null}
                <span className="book-cover-cta">Open to read</span>
              </div>
            </div>
          ) : chapter ? (
            <article className="book-chapter">
              <div className="reader-toolbar reader-toolbar-book">
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
                  <div className="progress-fill" style={{ width: `${totalChapters ? (100 * (chapterIndex + 1)) / totalChapters : 0}%` }} />
                </div>
                <div className="reader-actions">
                  <div className="font-size-buttons">
                      <button type="button" className={fontSize === 'small' ? 'active' : ''} onClick={() => setFontSize('small')} title="Small text">A</button>
                      <button type="button" className={fontSize === 'medium' ? 'active' : ''} onClick={() => setFontSize('medium')} title="Medium text">A</button>
                      <button type="button" className={fontSize === 'large' ? 'active' : ''} onClick={() => setFontSize('large')} title="Large text">A</button>
                    </div>
                    <div className="line-spacing-buttons">
                      <button type="button" className={lineSpacing === 'tight' ? 'active' : ''} onClick={() => setLineSpacing('tight')} title="Tight lines">≡</button>
                      <button type="button" className={lineSpacing === 'normal' ? 'active' : ''} onClick={() => setLineSpacing('normal')} title="Normal">≡</button>
                      <button type="button" className={lineSpacing === 'relaxed' ? 'active' : ''} onClick={() => setLineSpacing('relaxed')} title="Relaxed">≡</button>
                    </div>
                    <button type="button" className={'bookmark-btn' + (isBookmarked(storyId, chapterId) ? ' active' : '')} onClick={toggleBookmark} title="Bookmark this chapter">🔖</button>
                    <button type="button" className="copy-link-btn" onClick={shareChapter} title="Share">{copyFeedback ? 'Shared!' : 'Share'}</button>
                    <button type="button" className="copy-link-btn" onClick={exportChapter} title="Export as text">Export</button>
                  <div className="prev-next">
                    <button type="button" className="prev-next-btn" onClick={goPrevChapter} title="Previous chapter (← or J)">← Chapter</button>
                    <button type="button" className="prev-next-btn" disabled={!nextChapter} onClick={goNextChapter} title="Next chapter (→ or K)">Chapter →</button>
                  </div>
                </div>
              </div>
              <div
                className="reader-scroll-wrap"
                onClick={handleReaderClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleReaderTouchEnd}
                role="presentation"
              >
                <div className="reader-scroll-content">
                  <h2 className="chapter-title chapter-title-inline">{chapter.title}</h2>
                  <ChapterBody body={chapter.body} dropCap={true} />
                  {isLastChapter && (
                    <div className="book-end-inline">
                      <p className="book-end-title">The End</p>
                      <p className="book-end-story">{story?.title}</p>
                      <div className="book-end-actions">
                        <button type="button" className="prev-next-btn" onClick={() => setBookOpen(false)}>Back to cover</button>
                        <button type="button" className="prev-next-btn" onClick={() => setHasEntered(false)}>Library</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ) : (
            <p className="chapter-placeholder">Select a story and chapter.</p>
          )}
        </main>
      </div>
    </>
  );
}
