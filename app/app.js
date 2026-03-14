(function () {
  const storyListEl = document.getElementById('storyList');
  const tocEl = document.getElementById('toc');
  const bookTitleEl = document.getElementById('bookTitle');
  const bookSubtitleEl = document.getElementById('bookSubtitle');
  const placeholderEl = document.getElementById('placeholder');
  const contentEl = document.getElementById('content');
  const chapterTitleEl = document.getElementById('chapterTitle');
  const chapterBodyEl = document.getElementById('chapterBody');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  let stories = [];
  let selectedStoryId = null;

  const PLACEHOLDER_BODY = 'This chapter is in the Word document in this story’s folder. Run the extract script (see README) to load full text here, or open the .docx file on your computer to read.';

  function getKingdomChapters() {
    const titles = [
      'Chapter 1 The Three-Day Kingdom',
      'Chapter 2 The Skin I',
      'Chapter 3 The Gospel of',
      'Chapter 4 The Secret Room',
      'Chapter 5 The Ninety-Day Summer',
      'Chapter 6 The Secret Garden',
      'Chapter 7 The Thin Partition',
      'Chapter 8 The Unified Kingdom'
    ];
    return titles.map((title, i) => ({
      id: 'kingdom-' + (i + 1),
      title: title,
      body: PLACEHOLDER_BODY
    }));
  }

  function getOnlyOneChapters() {
    const titles = [
      'Chapter 1 The Delivery of',
      'Chapter 2 The Great Erasure',
      'Chapter 3 The Hallways of',
      'Chapter 4 The Kinetic Truth',
      'Chapter 5 The Market of',
      'Chapter 6 The Artifact of',
      'Chapter 7 The Journey to',
      'Chapter 8 The Festival of'
    ];
    return titles.map((title, i) => ({
      id: 'onlyone-' + (i + 1),
      title: title,
      body: PLACEHOLDER_BODY
    }));
  }

  function normalizeToStories(json) {
    const out = [];
    if (json.stories && Array.isArray(json.stories)) {
      json.stories.forEach((s) => {
        out.push({
          id: s.id || s.title.toLowerCase().replace(/\s+/g, '-'),
          title: s.title,
          subtitle: s.subtitle || '',
          chapters: flattenChapters(s.chapters || [])
        });
      });
      return out;
    }
    if (json.chapters && Array.isArray(json.chapters)) {
      const festivalChapters = json.chapters.filter((ch) => !ch.children);
      out.push({
        id: 'naked-festival',
        title: json.title || 'Naked Festival',
        subtitle: json.subtitle || '',
        chapters: festivalChapters
      });
      const familyBlock = json.chapters.find((ch) => ch.children && (ch.id === '_family' || ch.title && ch.title.includes('Naked Family')));
      if (familyBlock && familyBlock.children) {
        out.push({
          id: 'naked-family',
          title: familyBlock.title.replace(/\s*\(Extended\)\s*/i, '').trim() || 'Naked Family',
          subtitle: '',
          chapters: familyBlock.children
        });
      }
      out.push({
        id: 'the-3-day-kingdom',
        title: 'The 3-Day Kingdom',
        subtitle: '',
        chapters: json.stories ? (json.stories.find((s) => s.id === 'the-3-day-kingdom') || {}).chapters || [] : getKingdomChapters()
      });
      out.push({
        id: 'the-only-one-who-remembers',
        title: 'The Only One Who Remembers',
        subtitle: '',
        chapters: json.stories ? (json.stories.find((s) => s.id === 'the-only-one-who-remembers') || {}).chapters || [] : getOnlyOneChapters()
      });
    }
    return out;
  }

  function flattenChapters(chapters) {
    const flat = [];
    (chapters || []).forEach((ch) => {
      if (ch.children) flat.push(...ch.children);
      else flat.push(ch);
    });
    return flat;
  }

  function getSelectedStory() {
    return stories.find((s) => s.id === selectedStoryId) || stories[0] || null;
  }

  function renderStoryList() {
    storyListEl.innerHTML = '';
    stories.forEach((story) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'story-link' + (story.id === selectedStoryId ? ' active' : '');
      btn.textContent = story.title;
      btn.dataset.storyId = story.id;
      btn.addEventListener('click', () => selectStory(story.id));
      storyListEl.appendChild(btn);
    });
  }

  function selectStory(storyId) {
    selectedStoryId = storyId;
    const story = getSelectedStory();
    if (!story) return;
    bookTitleEl.textContent = story.title;
    bookSubtitleEl.textContent = story.subtitle || 'Chapters';
    renderStoryList();
    renderTOC();
    if (story.chapters.length) {
      const first = story.chapters[0];
      showChapter(first.id, first.title, first.body);
    } else {
      placeholderEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      placeholderEl.textContent = 'No chapters in this story yet.';
    }
  }

  function renderTOC() {
    const story = getSelectedStory();
    tocEl.innerHTML = '';
    if (!story || !story.chapters.length) return;
    story.chapters.forEach((ch) => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'toc-link';
      a.textContent = ch.title.length > 52 ? ch.title.slice(0, 52) + '…' : ch.title;
      a.dataset.id = ch.id;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        showChapter(ch.id, ch.title, ch.body);
        setActiveLink(ch.id);
        closeSidebar();
      });
      const wrap = document.createElement('div');
      wrap.className = 'toc-section';
      wrap.appendChild(a);
      tocEl.appendChild(wrap);
    });
  }

  function setActiveLink(id) {
    tocEl.querySelectorAll('.toc-link').forEach((a) => {
      a.classList.toggle('active', a.dataset.id === id);
    });
    storyListEl.querySelectorAll('.story-link').forEach((b) => {
      b.classList.toggle('active', b.dataset.storyId === selectedStoryId);
    });
  }

  function showChapter(id, title, body) {
    if (!body || !body.trim()) {
      placeholderEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      placeholderEl.textContent = 'No content for this chapter.';
      return;
    }
    placeholderEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    chapterTitleEl.textContent = title;
    const paras = body.split(/\n\n+/).filter((p) => p.trim());
    chapterBodyEl.innerHTML = paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    history.replaceState(null, '', '#' + encodeURIComponent(selectedStoryId) + '|' + encodeURIComponent(id));
    setActiveLink(id);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  function openSidebar() {
    document.body.classList.add('sidebar-open');
  }

  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  function findChapterInStories(chapterId) {
    for (const story of stories) {
      const ch = story.chapters.find((c) => c.id === chapterId);
      if (ch) return { story, chapter: ch };
    }
    return null;
  }

  fetch('content.json')
    .then((r) => r.json())
    .then((json) => {
      stories = normalizeToStories(json);
      if (!stories.length) {
        placeholderEl.textContent = 'No stories in content.json.';
        return;
      }
      selectedStoryId = stories[0].id;
      renderStoryList();
      const hash = window.location.hash.slice(1);
      if (hash) {
        const pipe = hash.indexOf('|');
        let storyId = null;
        let chapterId = null;
        if (pipe > 0) {
          storyId = decodeURIComponent(hash.slice(0, pipe));
          chapterId = decodeURIComponent(hash.slice(pipe + 1));
        } else if (hash) {
          chapterId = decodeURIComponent(hash);
        }
        const found = chapterId ? findChapterInStories(chapterId) : null;
        if (found) {
          selectedStoryId = found.story.id;
          selectStory(found.story.id);
          showChapter(found.chapter.id, found.chapter.title, found.chapter.body);
          return;
        }
      }
      selectStory(selectedStoryId);
    })
    .catch((err) => {
      placeholderEl.textContent = 'Could not load content. Make sure content.json exists (run scripts/extract_docx.py first).';
      console.error(err);
    });
})();
